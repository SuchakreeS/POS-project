import {
  adjustDelta,
  MOVEMENT_FILTERS,
  type adjustInputSchema,
  type Movement,
  type MovementPage,
  type MovementType,
  type movementQuerySchema,
  type Product,
  type restockInputSchema,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import { Prisma } from "../../generated/prisma/client";
import { decodeCursor, encodeCursor } from "../../lib/cursor";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";
import { productInclude, toProduct } from "../products/product.mapper";

export type RestockInput = z.output<typeof restockInputSchema>;
export type AdjustInput = z.output<typeof adjustInputSchema>;
export type MovementQuery = z.output<typeof movementQuerySchema>;

const productGone = () => HttpError.notFound("This item doesn't exist any more.");

// ---------- Restock ----------

/**
 * One delivery: a RESTOCK movement per product, the stock updates and one STOCK_RESTOCK audit entry,
 * all in one transaction (plan.md → Restock modal). The same product twice is added up.
 */
export async function restock(input: RestockInput, ctx: RequestContext): Promise<Product[]> {
  const totals = new Map<string, number>();
  for (const { productId, qty } of input.items)
    totals.set(productId, (totals.get(productId) ?? 0) + qty);
  // A fixed order, so two restocks touching the same products can't deadlock.
  const rows = [...totals].sort(([a], [b]) => a.localeCompare(b));

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.count({ where: { id: { in: rows.map(([id]) => id) } } });
    if (existing !== rows.length) {
      throw HttpError.badRequest(
        "One of the items doesn't exist any more. Remove it and try again.",
      );
    }

    const products = [];
    for (const [productId, qty] of rows) {
      products.push(
        await tx.product.update({
          where: { id: productId },
          data: { stockQty: { increment: qty } },
          include: productInclude,
        }),
      );
    }
    await tx.stockMovement.createMany({
      data: rows.map(([productId, qty]) => ({
        productId,
        type: "RESTOCK" as const,
        qty,
        reason: input.note,
        userId: ctx.actor.userId,
      })),
    });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "STOCK_RESTOCK",
        entityType: "Restock",
        after: {
          items: products.map((product) => {
            const qty = totals.get(product.id) ?? 0;
            return {
              productId: product.id,
              name: product.name,
              qty,
              stockBefore: product.stockQty - qty,
              stockAfter: product.stockQty,
            };
          }),
        },
        reason: input.note,
      },
      ctx.meta,
    );
    return products;
  });

  return updated.map(toProduct);
}

// ---------- Adjust ----------

/**
 * Remove / Add / Set count (plan.md → Adjust stock dialog): one signed ADJUST movement and a
 * STOCK_ADJUST audit entry. The row is locked first so "Set count" can't race a sale.
 */
export async function adjust(input: AdjustInput, ctx: RequestContext): Promise<Product> {
  const row = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ stockQty: number }[]>`
      SELECT "stockQty" FROM "Product" WHERE id = ${input.productId} FOR UPDATE`;
    if (!locked) throw productGone();

    const before = locked.stockQty;
    const delta = adjustDelta(input.mode, input.qty, before);
    if (delta === 0) {
      throw new HttpError(400, "VALIDATION", `Stock is already ${before}. Nothing to change.`, [
        { path: ["qty"], message: `Stock is already ${before}. Nothing to change.` },
      ]);
    }

    const product = await tx.product.update({
      where: { id: input.productId },
      data: { stockQty: { increment: delta } },
      include: productInclude,
    });
    const reason = input.note ? `${input.reason} — ${input.note}` : input.reason;
    await tx.stockMovement.create({
      data: { productId: product.id, type: "ADJUST", qty: delta, reason, userId: ctx.actor.userId },
    });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "STOCK_ADJUST",
        entityType: "Product",
        entityId: product.id,
        before: { stockQty: before },
        after: { stockQty: product.stockQty, mode: input.mode, qty: input.qty, change: delta },
        reason,
      },
      ctx.meta,
    );
    return product;
  });

  return toProduct(row);
}

// ---------- Movement history ----------

interface MovementRow {
  id: string;
  type: MovementType;
  qty: number;
  stockAfter: number;
  reason: string | null;
  createdAt: Date;
  userName: string;
  orderId: string | null;
  billNo: string | null;
}

/**
 * Newest first, with the stock level right after each movement. Stock-after is a running total
 * over ALL of the product's movements (a window function), so it stays right when filtering.
 */
export async function listMovements(query: MovementQuery): Promise<MovementPage> {
  const product = await prisma.product.findUnique({
    where: { id: query.productId },
    select: { id: true },
  });
  if (!product) throw productGone();

  const types: readonly string[] = MOVEMENT_FILTERS[query.filter];
  const after = query.cursor ? decodeCursor(query.cursor) : null;
  const olderThanCursor = after
    ? Prisma.sql`AND ("createdAt", id) < (${after.createdAt}, ${after.id})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<MovementRow[]>`
    SELECT * FROM (
      SELECT m.id, m.type, m.qty, m.reason, m."createdAt",
             u."displayName" AS "userName", m."orderId", o."billNo",
             (SUM(m.qty) OVER (ORDER BY m."createdAt", m.id))::int AS "stockAfter"
      FROM "StockMovement" m
      JOIN "User" u ON u.id = m."userId"
      LEFT JOIN "Order" o ON o.id = m."orderId"
      WHERE m."productId" = ${query.productId}
    ) history
    WHERE type::text = ANY(${types}::text[]) ${olderThanCursor}
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${query.limit + 1}`;

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toMovement),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}

function toMovement(row: MovementRow): Movement {
  return {
    id: row.id,
    type: row.type,
    qty: row.qty,
    stockAfter: row.stockAfter,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    userName: row.userName,
    order: row.orderId && row.billNo ? { id: row.orderId, billNo: row.billNo } : null,
  };
}
