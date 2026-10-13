import type { Order } from "@pos/shared";
import type { Prisma } from "../../generated/prisma/client";

export const orderInclude = {
  items: { orderBy: { id: "asc" } },
  terminal: { select: { code: true } },
  cashier: { select: { displayName: true } },
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
    createdAt: row.createdAt.toISOString(),
  };
}
