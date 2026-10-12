import { z } from "zod";
import { satangSchema } from "./pricing";

/*
 * Products and categories (plan.md → Product catalog, Stock page, Add / Edit item).
 * Schemas are used by the API to validate and by the web forms to show the same messages.
 */

export const PRODUCT_NAME_MAX = 120;
export const BARCODE_MAX = 64;
export const SKU_MAX = 40;
export const CATEGORY_NAME_MAX = 40;
/** Largest stock count or low-stock alert the app accepts. */
export const MAX_STOCK_QTY = 1_000_000;

// ---------- Types returned by the API ----------

export interface CategoryRef {
  id: string;
  name: string;
}

export interface Category extends CategoryRef {
  /** Active products in this category. */
  productCount: number;
}

export interface Product {
  id: string;
  barcode: string | null;
  sku: string | null;
  name: string;
  category: CategoryRef | null;
  /** Selling price, satang. */
  price: number;
  /** Unit cost, satang. */
  cost: number | null;
  stockQty: number;
  /** "Low" when stock is at or below this. Null = never low. */
  lowStockAt: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductList {
  items: Product[];
}

export interface CategoryList {
  items: Category[];
}

// ---------- Stock status (one definition for the Stock page, checkout badges and reports) ----------

export type StockStatus = "OUT" | "LOW" | "OK";

export function stockStatus(product: Pick<Product, "stockQty" | "lowStockAt">): StockStatus {
  if (product.stockQty <= 0) return "OUT";
  if (product.lowStockAt !== null && product.stockQty <= product.lowStockAt) return "LOW";
  return "OK";
}

/** Profit per unit and margin, for the "profit hint" under the price fields. Null without a cost. */
export function unitProfit(
  price: number,
  cost: number | null,
): { profit: number; marginPercent: number } | null {
  if (cost === null || price <= 0) return null;
  const profit = price - cost;
  return { profit, marginPercent: Math.round((profit / price) * 1000) / 10 };
}

// ---------- Field schemas ----------

const collapseSpaces = (value: string) => value.replace(/\s+/g, " ");

/** Optional text field: "" becomes null. */
const optional = <T extends z.ZodType<string | null>>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    schema.nullable(),
  );

export const categoryNameSchema = z
  .string({ error: "Enter a category name" })
  .trim()
  .min(1, "Enter a category name")
  .max(CATEGORY_NAME_MAX, "Category name is too long")
  .transform(collapseSpaces);

export const barcodeSchema = z
  .string({ error: "Scan or type the barcode" })
  .trim()
  .min(1, "Scan or type the barcode")
  .max(BARCODE_MAX, "Barcode is too long")
  .regex(/^[0-9A-Za-z-]+$/, "Barcode can only have letters, numbers and dashes");

export const skuSchema = z
  .string()
  .trim()
  .max(SKU_MAX, "SKU is too long")
  .regex(/^[0-9A-Za-z._-]+$/, "SKU can only have letters, numbers, dot, dash or underscore")
  .transform((value) => value.toUpperCase());

export const productNameSchema = z
  .string({ error: "Enter the item name" })
  .trim()
  .min(1, "Enter the item name")
  .max(PRODUCT_NAME_MAX, "Item name is too long")
  .transform(collapseSpaces);

export const sellingPriceSchema = satangSchema.min(1, "Selling price must be more than 0");

const stockCountSchema = (label: string) =>
  z
    .number({ error: `Enter the ${label}` })
    .int(`${capitalize(label)} must be a whole number`)
    .min(0, `${capitalize(label)} can't be negative`)
    .max(MAX_STOCK_QTY, `${capitalize(label)} is too large`);

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- Request bodies ----------

export const categoryInputSchema = z.object({ name: categoryNameSchema });
export type CategoryInput = z.input<typeof categoryInputSchema>;

const productFields = {
  barcode: barcodeSchema,
  name: productNameSchema,
  categoryId: z.uuid("Pick a category from the list").nullable(),
  /** Left empty → the API makes one (SKU-00001, SKU-00002, …). */
  sku: optional(skuSchema),
  price: sellingPriceSchema,
  cost: satangSchema.nullable(),
  lowStockAt: stockCountSchema("low-stock alert").nullable(),
};

/** POST /products */
export const productCreateSchema = z.object({
  ...productFields,
  startingStock: stockCountSchema("starting stock"),
});
export type ProductCreateInput = z.input<typeof productCreateSchema>;

/** PATCH /products/:id — send only what changed. Stock never changes here (only through movements). */
export const productUpdateSchema = z.object(productFields).partial();
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;

/** POST /products/:id/deactivate and /reactivate */
export const productStatusSchema = z.object({
  reason: optional(z.string().trim().max(200, "Reason is too long")).optional(),
});

/** GET /products query string. */
export const productListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(["active", "inactive", "all"]).default("active"),
});
export type ProductListQuery = z.input<typeof productListQuerySchema>;
