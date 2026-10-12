import { stockStatus, type Product } from "@pos/shared";

/*
 * Stock page filtering, on the client: the page loads every product once (a few hundred at most),
 * so typing and scanning filter instantly. If the catalog grows into the thousands, move search
 * to the API — GET /products already takes ?search=&categoryId=.
 */

export type StockView = "all" | "low" | "out" | "off";
/** "" = every category, "none" = items without a category. */
export type CategoryFilter = string;
export const NO_CATEGORY = "none";

export interface StockFilter {
  search: string;
  view: StockView;
  category: CategoryFilter;
}

export type StockCounts = Record<StockView, number>;

/** Name or SKU contains the text, or the barcode starts with it (a full scan matches exactly). */
export function matchesSearch(product: Product, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    product.name.toLowerCase().includes(q) ||
    (product.sku?.toLowerCase().includes(q) ?? false) ||
    (product.barcode?.toLowerCase().startsWith(q) ?? false)
  );
}

function matchesCategory(product: Product, category: CategoryFilter): boolean {
  if (!category) return true;
  if (category === NO_CATEGORY) return product.category === null;
  return product.category?.id === category;
}

function matchesView(product: Product, view: StockView): boolean {
  if (view === "off") return !product.isActive;
  if (!product.isActive) return false;
  if (view === "all") return true;
  return stockStatus(product) === (view === "low" ? "LOW" : "OUT");
}

const STATUS_ORDER = { OUT: 0, LOW: 1, OK: 2 } as const;

/** Out first, then Low, then by name (plan.md → Stock page). */
export function compareForStock(a: Product, b: Product): number {
  return (
    STATUS_ORDER[stockStatus(a)] - STATUS_ORDER[stockStatus(b)] ||
    a.name.localeCompare(b.name, "th")
  );
}

/** The rows to show, plus the chip counts (counts follow the search and category, not the chip). */
export function filterStock(products: readonly Product[], filter: StockFilter) {
  const base = products.filter(
    (product) => matchesSearch(product, filter.search) && matchesCategory(product, filter.category),
  );
  const counts: StockCounts = { all: 0, low: 0, out: 0, off: 0 };
  for (const product of base) {
    for (const view of ["all", "low", "out", "off"] as const) {
      if (matchesView(product, view)) counts[view] += 1;
    }
  }
  const rows = base.filter((product) => matchesView(product, filter.view)).sort(compareForStock);
  return { rows, counts };
}
