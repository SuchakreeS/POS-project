import type { Order } from "@pos/shared";
import type { Prisma } from "../../generated/prisma/client";

export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  terminal: { select: { code: true } },
  cashier: { select: { displayName: true } },
  promptpayReceivedBy: { select: { displayName: true } },
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
    createdAt: row.createdAt.toISOString(),
  };
}
