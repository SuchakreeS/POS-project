import {
  calculateBill,
  calculateCash,
  formatBillNo,
  formatTHB,
  type BillTotals,
  type CheckoutResponse,
  type checkoutInputSchema,
  type paymentInputSchema,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Prisma } from "../../generated/prisma/client";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";
import { balanceOf, resolveCustomer } from "../credit/credit.service";
import { orderInclude, toOrder, type OrderRow } from "./order.mapper";

export type CheckoutInput = z.output<typeof checkoutInputSchema>;
type PaymentInput = z.output<typeof paymentInputSchema>;

export interface CheckoutResult extends CheckoutResponse {
  /** False when this key was already used: the earlier bill is returned instead of a new one. */
  created: boolean;
}

/**
 * Checkout (plan.md → Checkout transaction): all-or-nothing, in one transaction.
 * The same Idempotency-Key always returns the same bill, so a double Enter or a retry after a
 * dropped connection can never make two bills.
 */
export async function checkout(
  input: CheckoutInput,
  idempotencyKey: string,
  ctx: RequestContext,
): Promise<CheckoutResult> {
  const existing = await findByKey(idempotencyKey);
  if (existing) return { ...existing, created: false };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const terminal = await nextBillNumber(tx, input.terminalId);
      // Every audit entry of this sale records the terminal it was made on.
      const saleCtx = { ...ctx, meta: { ...ctx.meta, terminalId: terminal.id } };
      const lines = await priceLines(tx, input.items);
      const totals = calculateBill(lines, input.discount); // never trust totals from the client
      const payment = await preparePayment(tx, input.payment, totals, saleCtx);

      const order = await tx.order.create({
        data: {
          billNo: terminal.billNo,
          idempotencyKey,
          terminalId: terminal.id,
          cashierId: ctx.actor.userId,
          subtotal: totals.subtotal,
          discountType: input.discount ? input.discount.type : null,
          discountValue: totals.discountValue,
          discountAmount: totals.discountAmount,
          total: totals.total,
          clientCreatedAt: new Date(input.clientCreatedAt),
          ...payment.orderFields,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              unitPrice: line.unitPrice,
              qty: line.qty,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: orderInclude,
      });

      await cutStock(tx, lines, order.id, saleCtx);
      const customerBalance = await payment.afterCreate(order);
      await auditSale(tx, order, totals, input.discount !== null, lines, saleCtx);

      // Re-read so the response includes the credit customer linked just above.
      const saved = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: orderInclude,
      });
      return { order: toOrder(saved), customerBalance };
    });
    return { ...result, created: true };
  } catch (error) {
    // Two requests with the same key at the same moment: the loser returns the winner's bill.
    if (isUniqueViolation(error)) {
      const winner = await findByKey(idempotencyKey);
      if (winner) return { ...winner, created: false };
    }
    throw error;
  }
}

async function findByKey(idempotencyKey: string): Promise<CheckoutResponse | null> {
  const row = await prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
  if (!row) return null;
  const order = toOrder(row);
  return {
    order,
    customerBalance: order.customer ? await balanceOf(prisma, order.customer.id) : null,
  };
}

// ---------- Steps ----------

/** Bump the terminal's counter (row lock: numbers never repeat; a failed sale rolls it back). */
async function nextBillNumber(tx: Db, terminalId: string) {
  const device = await tx.terminal.findUnique({ where: { id: terminalId } });
  if (!device?.isActive)
    throw HttpError.badRequest("This checkout device isn't set up. Ask the admin.");
  const terminal = await tx.terminal.update({
    where: { id: device.id },
    data: { lastBillSeq: { increment: 1 } },
  });
  return { id: terminal.id, billNo: formatBillNo(terminal.code, terminal.lastBillSeq) };
}

type PricedLine = Awaited<ReturnType<typeof priceLines>>[number];

/** Today's name and price for each product, snapshotted onto the bill. Same item twice is added up. */
async function priceLines(tx: Db, items: CheckoutInput["items"]) {
  const qtyById = new Map<string, number>();
  for (const { productId, qty } of items)
    qtyById.set(productId, (qtyById.get(productId) ?? 0) + qty);

  const products = await tx.product.findMany({ where: { id: { in: [...qtyById.keys()] } } });
  if (products.length !== qtyById.size) {
    throw HttpError.conflict(
      "An item on this bill was removed. Take it off the bill and try again.",
    );
  }
  const turnedOff = products.find((product) => !product.isActive);
  if (turnedOff) throw HttpError.conflict(`${turnedOff.name} is turned off. Take it off the bill.`);

  return products
    .map((product) => {
      const qty = qtyById.get(product.id) ?? 0;
      return { product, qty, unitPrice: product.price, lineTotal: product.price * qty };
    })
    .sort((a, b) => a.product.id.localeCompare(b.product.id)); // fixed lock order for the stock updates
}

/**
 * Check the payment before anything is written, and say what to store on the order.
 * `afterCreate` runs once the order exists (credit: the CHARGE entry) and returns the new balance.
 */
async function preparePayment(
  tx: Db,
  payment: PaymentInput,
  totals: BillTotals,
  ctx: RequestContext,
): Promise<{
  orderFields: Pick<
    Prisma.OrderUncheckedCreateInput,
    "paymentMethod" | "cashReceived" | "changeGiven" | "promptpayStatus"
  >;
  afterCreate: (order: OrderRow) => Promise<number | null>;
}> {
  switch (payment.method) {
    case "CASH": {
      const cash = calculateCash(totals.total, payment.cashReceived);
      if (cash.short > 0)
        throw HttpError.badRequest(`Not enough cash: short by ${formatTHB(cash.short)}.`);
      return {
        orderFields: {
          paymentMethod: "CASH",
          cashReceived: payment.cashReceived,
          changeGiven: cash.change,
        },
        afterCreate: async () => null,
      };
    }

    case "PROMPTPAY":
      // Saved as pending; staff mark it received after checking the bank app (plan.md → PromptPay).
      return {
        orderFields: { paymentMethod: "PROMPTPAY", promptpayStatus: "PENDING" },
        afterCreate: async () => null,
      };

    case "CREDIT": {
      if (totals.total === 0)
        throw HttpError.badRequest("The total is 0.00 — there's nothing to put on credit.");
      const customer = await resolveCustomer(tx, payment.customer, ctx);
      const before = await balanceOf(tx, customer.id);
      return {
        orderFields: { paymentMethod: "CREDIT" },
        afterCreate: async (order) => {
          const after = before + order.total;
          const entry = await tx.creditEntry.create({
            data: {
              customerId: customer.id,
              type: "CHARGE",
              amount: order.total,
              orderId: order.id,
              userId: ctx.actor.userId,
            },
          });
          await writeAudit(
            tx,
            ctx.actor,
            {
              action: "CREDIT_CHARGE",
              entityType: "CreditEntry",
              entityId: entry.id,
              after: {
                customer: customer.name,
                billNo: order.billNo,
                amount: order.total,
                balanceBefore: before,
                balanceAfter: after,
              },
            },
            ctx.meta,
          );
          return after;
        },
      };
    }
  }
}

/** A SALE movement per line. Going below 0 is allowed (stock may be wrong; it shows as Out). */
async function cutStock(tx: Db, lines: PricedLine[], orderId: string, ctx: RequestContext) {
  for (const line of lines) {
    await tx.product.update({
      where: { id: line.product.id },
      data: { stockQty: { decrement: line.qty } },
    });
  }
  await tx.stockMovement.createMany({
    data: lines.map((line) => ({
      productId: line.product.id,
      type: "SALE" as const,
      qty: -line.qty,
      orderId,
      userId: ctx.actor.userId,
    })),
  });
}

async function auditSale(
  tx: Db,
  order: OrderRow,
  totals: BillTotals,
  hasDiscount: boolean,
  lines: PricedLine[],
  ctx: RequestContext,
) {
  await writeAudit(
    tx,
    ctx.actor,
    {
      action: "ORDER_CREATE",
      entityType: "Order",
      entityId: order.id,
      after: {
        billNo: order.billNo,
        total: totals.total,
        method: order.paymentMethod,
        itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
      },
    },
    ctx.meta,
  );
  if (hasDiscount) {
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "DISCOUNT_APPLIED",
        entityType: "Order",
        entityId: order.id,
        after: {
          billNo: order.billNo,
          typed: totals.discountValue,
          applied: totals.discountAmount,
          subtotal: totals.subtotal,
        },
      },
      ctx.meta,
    );
  }
}
