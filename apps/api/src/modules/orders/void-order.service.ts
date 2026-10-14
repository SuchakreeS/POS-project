import type { Order, voidInputSchema } from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";
import { balanceOf } from "../credit/credit.service";
import { billGone } from "./order-history.service";
import { orderInclude, toOrder, type OrderRow } from "./order.mapper";

export type VoidInput = z.output<typeof voidInputSchema>;

/**
 * Void a bill (plan.md → Void): one transaction that marks it VOIDED, puts the stock back,
 * cancels the credit charge and writes the audit log. The bill is never deleted.
 * The order row is locked first, so a double click or two people voiding at once void it once,
 * and a PromptPay "Mark received" at the same moment can't slip in between.
 */
export async function voidOrder(id: string, input: VoidInput, ctx: RequestContext): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ status: string; billNo: string }[]>`
      SELECT status, "billNo" FROM "Order" WHERE id = ${id} FOR UPDATE`;
    if (!locked) throw billGone();
    if (locked.status === "VOIDED")
      throw HttpError.conflict(`Bill ${locked.billNo} is already voided.`);

    const order = await tx.order.update({
      where: { id },
      data: {
        status: "VOIDED",
        voidReason: input.reason,
        voidNote: input.note,
        voidedById: ctx.actor.userId,
        voidedAt: new Date(),
      },
      include: orderInclude,
    });

    await returnStock(tx, order, ctx);
    if (order.paymentMethod === "CREDIT") await cancelCharge(tx, order, ctx);

    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "ORDER_VOID",
        entityType: "Order",
        entityId: order.id,
        before: { status: "COMPLETED", promptpayStatus: order.promptpayStatus },
        after: {
          billNo: order.billNo,
          total: order.total,
          method: order.paymentMethod,
          itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
          note: input.note,
        },
        reason: input.reason,
      },
      ctx.meta,
    );
    return toOrder(order);
  });
}

/** A VOID_RETURN movement per line (product ids in a fixed order, like checkout, to avoid deadlocks). */
async function returnStock(tx: Db, order: OrderRow, ctx: RequestContext) {
  const items = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: item.qty } },
    });
  }
  await tx.stockMovement.createMany({
    data: items.map((item) => ({
      productId: item.productId,
      type: "VOID_RETURN" as const,
      qty: item.qty,
      orderId: order.id,
      userId: ctx.actor.userId,
    })),
  });
}

/**
 * CHARGE_VOID for the bill's amount: lowers what the customer owes, but isn't money received.
 * If they already paid part of it, the balance goes below 0 (the shop owes them; plan.md → Credit).
 */
async function cancelCharge(tx: Db, order: OrderRow, ctx: RequestContext) {
  const customer = order.creditEntries[0]?.customer;
  if (!customer) return; // a credit bill always has its CHARGE; nothing to reverse otherwise

  // Same lock as Record payment, so the balance before → after is exact.
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customer.id} FOR UPDATE`;
  const before = await balanceOf(tx, customer.id);
  const entry = await tx.creditEntry.create({
    data: {
      customerId: customer.id,
      type: "CHARGE_VOID",
      amount: order.total,
      orderId: order.id,
      userId: ctx.actor.userId,
    },
  });
  await writeAudit(
    tx,
    ctx.actor,
    {
      action: "CREDIT_CHARGE_VOID",
      entityType: "CreditEntry",
      entityId: entry.id,
      after: {
        customer: customer.name,
        billNo: order.billNo,
        amount: order.total,
        balanceBefore: before,
        balanceAfter: before - order.total,
      },
    },
    ctx.meta,
  );
}
