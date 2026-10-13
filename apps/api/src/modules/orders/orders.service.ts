import {
  calculateBill,
  calculateCash,
  formatBillNo,
  formatTHB,
  type checkoutInputSchema,
  type Order,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";
import { orderInclude, toOrder } from "./order.mapper";

export type CheckoutInput = z.output<typeof checkoutInputSchema>;

export interface CheckoutResult {
  order: Order;
  /** False when this key was already used: the earlier bill is returned instead of a new one. */
  created: boolean;
}

async function findByKey(idempotencyKey: string) {
  const row = await prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
  return row && toOrder(row);
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
  if (existing) return { order: existing, created: false };

  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Bill number: bump the terminal's counter (row lock = numbers never repeat or skip).
      const device = await tx.terminal.findUnique({ where: { id: input.terminalId } });
      if (!device?.isActive)
        throw HttpError.badRequest("This checkout device isn't set up. Ask the admin.");
      const terminal = await tx.terminal.update({
        where: { id: device.id },
        data: { lastBillSeq: { increment: 1 } },
      });
      const billNo = formatBillNo(terminal.code, terminal.lastBillSeq);

      // 2. Products: current price and name, snapshotted onto the bill. Same item twice is added up.
      const qtyById = new Map<string, number>();
      for (const { productId, qty } of input.items)
        qtyById.set(productId, (qtyById.get(productId) ?? 0) + qty);
      const products = await tx.product.findMany({ where: { id: { in: [...qtyById.keys()] } } });
      if (products.length !== qtyById.size) {
        throw HttpError.conflict(
          "An item on this bill was removed. Take it off the bill and try again.",
        );
      }
      const turnedOff = products.find((product) => !product.isActive);
      if (turnedOff)
        throw HttpError.conflict(`${turnedOff.name} is turned off. Take it off the bill.`);

      const lines = products
        .map((product) => {
          const qty = qtyById.get(product.id) ?? 0;
          return { product, qty, unitPrice: product.price, lineTotal: product.price * qty };
        })
        .sort((a, b) => a.product.id.localeCompare(b.product.id)); // fixed lock order

      // 3. Totals, computed here — never trusted from the client.
      const totals = calculateBill(lines, input.discount);

      // 4. Payment.
      const cash = calculateCash(totals.total, input.payment.cashReceived);
      if (cash.short > 0) {
        throw HttpError.badRequest(`Not enough cash: short by ${formatTHB(cash.short)}.`);
      }

      // 5. The bill and its lines.
      const created = await tx.order.create({
        data: {
          billNo,
          idempotencyKey,
          terminalId: terminal.id,
          cashierId: ctx.actor.userId,
          subtotal: totals.subtotal,
          discountType: input.discount ? input.discount.type : null,
          discountValue: totals.discountValue,
          discountAmount: totals.discountAmount,
          total: totals.total,
          paymentMethod: "CASH",
          cashReceived: input.payment.cashReceived,
          changeGiven: cash.change,
          clientCreatedAt: new Date(input.clientCreatedAt),
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

      // 6. Stock: a SALE movement per line. Going below 0 is allowed (stock may be wrong; it shows as Out).
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
          orderId: created.id,
          userId: ctx.actor.userId,
        })),
      });

      // 7. Audit, same transaction.
      const meta = { ...ctx.meta, terminalId: terminal.id };
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "ORDER_CREATE",
          entityType: "Order",
          entityId: created.id,
          after: {
            billNo,
            total: totals.total,
            method: "CASH",
            itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
          },
        },
        meta,
      );
      if (input.discount) {
        await writeAudit(
          tx,
          ctx.actor,
          {
            action: "DISCOUNT_APPLIED",
            entityType: "Order",
            entityId: created.id,
            after: {
              billNo,
              typed: totals.discountValue,
              applied: totals.discountAmount,
              subtotal: totals.subtotal,
            },
          },
          meta,
        );
      }
      return toOrder(created);
    });
    return { order, created: true };
  } catch (error) {
    // Two requests with the same key at the same moment: the loser returns the winner's bill.
    if (isUniqueViolation(error)) {
      const winner = await findByKey(idempotencyKey);
      if (winner) return { order: winner, created: false };
    }
    throw error;
  }
}
