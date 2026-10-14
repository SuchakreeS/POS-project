import type { Order, OrderSummary } from "@pos/shared";
import type { Prisma } from "../../generated/prisma/client";

export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  terminal: { select: { code: true } },
  cashier: { select: { displayName: true } },
  promptpayReceivedBy: { select: { displayName: true } },
  voidedBy: { select: { displayName: true } },
  creditEntries: {
    where: { type: "CHARGE" },
    select: { customer: { select: { id: true, name: true } } },
  },
} as const satisfies Prisma.OrderInclude;

export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    billNo: row.billNo,
    status: row.status,
    terminalCode: row.terminal.code,
    cashierName: row.cashier.displayName,
    items: row.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice,
      qty: item.qty,
      lineTotal: item.lineTotal,
    })),
    subtotal: row.subtotal,
    discountValue: row.discountValue,
    discountAmount: row.discountAmount,
    total: row.total,
    paymentMethod: row.paymentMethod,
    cashReceived: row.cashReceived,
    changeGiven: row.changeGiven,
    promptpay: row.promptpayStatus
      ? {
          status: row.promptpayStatus,
          receivedAt: row.promptpayReceivedAt?.toISOString() ?? null,
          receivedBy: row.promptpayReceivedBy?.displayName ?? null,
        }
      : null,
    customer: row.creditEntries[0]?.customer ?? null,
    voided:
      row.status === "VOIDED" && row.voidedAt
        ? {
            at: row.voidedAt.toISOString(),
            by: row.voidedBy?.displayName ?? "",
            reason: row.voidReason ?? "",
            note: row.voidNote,
          }
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------- Orders table ----------

export const orderSummarySelect = {
  id: true,
  billNo: true,
  status: true,
  paymentMethod: true,
  promptpayStatus: true,
  total: true,
  createdAt: true,
  items: { select: { qty: true } },
  creditEntries: { where: { type: "CHARGE" }, select: { customer: { select: { name: true } } } },
} as const satisfies Prisma.OrderSelect;

type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    billNo: row.billNo,
    status: row.status,
    paymentMethod: row.paymentMethod,
    promptpayStatus: row.promptpayStatus,
    customerName: row.creditEntries[0]?.customer.name ?? null,
    lineCount: row.items.length,
    pieceCount: row.items.reduce((sum, item) => sum + item.qty, 0),
    total: row.total,
    createdAt: row.createdAt.toISOString(),
  };
}
