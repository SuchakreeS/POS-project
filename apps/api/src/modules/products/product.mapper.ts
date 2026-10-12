import type { Product } from "@pos/shared";
import type { Prisma } from "../../generated/prisma/client";

/** Always load products with this include so they can be mapped to the API shape. */
export const productInclude = { category: { select: { id: true, name: true } } } as const;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    barcode: row.barcode,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stockQty: row.stockQty,
    lowStockAt: row.lowStockAt,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What the audit log records about a product. Category by name, so the log reads well later. */
export function auditSnapshot(row: ProductRow) {
  return {
    barcode: row.barcode,
    sku: row.sku,
    name: row.name,
    category: row.category?.name ?? null,
    price: row.price,
    cost: row.cost,
    lowStockAt: row.lowStockAt,
  };
}

type Snapshot = ReturnType<typeof auditSnapshot>;
type SnapshotKey = keyof Snapshot;

/** Only the keys that changed, as before/after objects. Null when nothing changed. */
export function diffSnapshots(before: Snapshot, after: Snapshot, keys: readonly SnapshotKey[]) {
  const changed = keys.filter((key) => before[key] !== after[key]);
  if (changed.length === 0) return null;
  const pick = (snapshot: Snapshot) =>
    Object.fromEntries(changed.map((key) => [key, snapshot[key]]));
  return { before: pick(before), after: pick(after) };
}

export const PRICE_KEYS = ["price", "cost"] as const satisfies readonly SnapshotKey[];
export const DETAIL_KEYS = [
  "barcode",
  "sku",
  "name",
  "category",
  "lowStockAt",
] as const satisfies readonly SnapshotKey[];
