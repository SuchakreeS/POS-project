import {
  bangkokPeriod,
  emptyMethodStats,
  PAYMENT_METHODS,
  type Order,
  type OrderPage,
  type OrderStats,
  type orderListQuerySchema,
} from "@pos/shared";
import type { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { decodeCursor, encodeCursor } from "../../lib/cursor";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { orderInclude, orderSummarySelect, toOrder, toOrderSummary } from "./order.mapper";

export type OrderListQuery = z.output<typeof orderListQuerySchema>;

export const billGone = () => HttpError.notFound("This bill doesn't exist.");

/** Orders page (plan.md → Orders page): bills in a date range, newest first, a page at a time. */
export async function listOrders(query: OrderListQuery): Promise<OrderPage> {
  const base = baseWhere(query);
  const after = query.cursor ? decodeCursor(query.cursor) : null;

  const [rows, stats] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [
          base,
          filterWhere(query.filter),
          after
            ? {
                OR: [
                  { createdAt: { lt: after.createdAt } },
                  { createdAt: after.createdAt, id: { lt: after.id } },
                ],
              }
            : {},
        ],
      },
      select: orderSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1, // one extra tells us whether there's another page
    }),
    statsOf(base),
  ]);

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toOrderSummary),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    stats,
  };
}

export async function getOrder(id: string): Promise<Order> {
  const row = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!row) throw billGone();
  return toOrder(row);
}

/** Dates + search: what the summary strip and every chip count follow. */
function baseWhere(query: OrderListQuery): Prisma.OrderWhereInput {
  const { start, end } = bangkokPeriod(query.from, query.to);
  const search = query.search;
  return {
    createdAt: { gte: start, lt: end },
    ...(search && {
      OR: [
        { billNo: { contains: search, mode: "insensitive" } },
        {
          creditEntries: {
            some: { type: "CHARGE", customer: { name: { contains: search, mode: "insensitive" } } },
          },
        },
      ],
    }),
  };
}

function filterWhere(filter: OrderListQuery["filter"]): Prisma.OrderWhereInput {
  if (filter === "ALL") return {};
  if (filter === "VOIDED") return { status: "VOIDED" };
  return { paymentMethod: filter };
}

/** Bills and sales per payment method; voided bills are counted apart and never add to sales. */
async function statsOf(where: Prisma.OrderWhereInput): Promise<OrderStats> {
  const groups = await prisma.order.groupBy({
    by: ["paymentMethod", "status", "promptpayStatus"],
    where,
    _count: { _all: true },
    _sum: { total: true },
  });

  const stats = Object.fromEntries(
    PAYMENT_METHODS.map((method) => [method, emptyMethodStats()]),
  ) as OrderStats;
  for (const group of groups) {
    const row = stats[group.paymentMethod];
    const count = group._count._all;
    const total = group._sum.total ?? 0;
    if (group.status === "VOIDED") {
      row.voided += count;
      row.voidedTotal += total;
    } else {
      row.bills += count;
      row.sales += total;
      if (group.promptpayStatus === "PENDING") row.promptpayPending += count;
    }
  }
  return stats;
}
