import {
  bangkokDateKey,
  bangkokDayRange,
  type PromptPayBill,
  type PromptPayBoard,
  type PromptPaySummary,
} from "@pos/shared";
import { writeAudit } from "../../audit/audit";
import type { Prisma } from "../../generated/prisma/client";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";

/*
 * PromptPay check page (plan.md → PromptPay). Only PENDING → RECEIVED is allowed;
 * undoing a mistaken "received" needs a reason. Voided bills drop off the list.
 */

const billSelect = {
  id: true,
  billNo: true,
  total: true,
  createdAt: true,
  promptpayStatus: true,
  promptpayReceivedAt: true,
  cashier: { select: { displayName: true } },
  promptpayReceivedBy: { select: { displayName: true } },
} as const satisfies Prisma.OrderSelect;

type BillRow = Prisma.OrderGetPayload<{ select: typeof billSelect }>;

function toBill(row: BillRow): PromptPayBill {
  return {
    orderId: row.id,
    billNo: row.billNo,
    total: row.total,
    cashierName: row.cashier.displayName,
    createdAt: row.createdAt.toISOString(),
    status: row.promptpayStatus ?? "PENDING",
    receivedAt: row.promptpayReceivedAt?.toISOString() ?? null,
    receivedBy: row.promptpayReceivedBy?.displayName ?? null,
  };
}

const promptpayBills = {
  paymentMethod: "PROMPTPAY",
  status: "COMPLETED",
} as const satisfies Prisma.OrderWhereInput;

/** Every pending bill (any date, so nothing is forgotten) and today's received ones, oldest first. */
export async function getBoard(now = new Date()): Promise<PromptPayBoard> {
  const today = bangkokDayRange(bangkokDateKey(now));
  const [pending, receivedToday] = await Promise.all([
    prisma.order.findMany({
      where: { ...promptpayBills, promptpayStatus: "PENDING" },
      select: billSelect,
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        ...promptpayBills,
        promptpayStatus: "RECEIVED",
        promptpayReceivedAt: { gte: today.start, lt: today.end },
      },
      select: billSelect,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const sum = (rows: BillRow[]) => rows.reduce((total, row) => total + row.total, 0);
  return {
    pending: pending.map(toBill),
    receivedToday: receivedToday.map(toBill),
    stats: {
      pendingCount: pending.length,
      pendingTotal: sum(pending),
      receivedTodayCount: receivedToday.length,
      receivedTodayTotal: sum(receivedToday),
    },
  };
}

export async function getSummary(): Promise<PromptPaySummary> {
  return {
    pendingCount: await prisma.order.count({
      where: { ...promptpayBills, promptpayStatus: "PENDING" },
    }),
  };
}

/**
 * Mark bills received (one PROMPTPAY_RECEIVED entry per bill). Bills that are no longer pending
 * (already received by someone else, or voided) are skipped, so a double click is harmless.
 */
export async function markReceived(
  orderIds: readonly string[],
  ctx: RequestContext,
): Promise<PromptPayBill[]> {
  const ids = [...new Set(orderIds)];
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const received: string[] = [];
    for (const id of ids) {
      const { count } = await tx.order.updateMany({
        where: { id, ...promptpayBills, promptpayStatus: "PENDING" },
        data: {
          promptpayStatus: "RECEIVED",
          promptpayReceivedAt: now,
          promptpayReceivedById: ctx.actor.userId,
        },
      });
      if (count === 1) received.push(id);
    }

    const rows = await tx.order.findMany({ where: { id: { in: received } }, select: billSelect });
    for (const row of rows) {
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "PROMPTPAY_RECEIVED",
          entityType: "Order",
          entityId: row.id,
          after: { billNo: row.billNo, amount: row.total },
        },
        ctx.meta,
      );
    }
    return rows.map(toBill);
  });
}

/** Back to pending, with a reason (plan.md: undo needs a reason and is audit logged). */
export async function undoReceived(
  orderId: string,
  reason: string,
  ctx: RequestContext,
): Promise<PromptPayBill> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.order.findFirst({
      where: { id: orderId, ...promptpayBills },
      select: billSelect,
    });
    if (!before) throw HttpError.notFound("This PromptPay bill doesn't exist or was voided.");
    if (before.promptpayStatus !== "RECEIVED")
      throw HttpError.conflict("This bill isn't marked received.");

    const after = await tx.order.update({
      where: { id: orderId },
      data: { promptpayStatus: "PENDING", promptpayReceivedAt: null, promptpayReceivedById: null },
      select: billSelect,
    });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "PROMPTPAY_RECEIVED_UNDO",
        entityType: "Order",
        entityId: orderId,
        before: {
          billNo: before.billNo,
          receivedAt: before.promptpayReceivedAt?.toISOString() ?? null,
          receivedBy: before.promptpayReceivedBy?.displayName ?? null,
        },
        reason,
      },
      ctx.meta,
    );
    return toBill(after);
  });
}
