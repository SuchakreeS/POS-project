import {
  parseThb,
  productCreateSchema,
  satangToInput,
  type ApiErrorIssue,
  type Product,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@pos/shared";
import { isApiError } from "@/lib/http-client";

/*
 * Add / Edit item form logic, kept out of the components so it can be tested on its own.
 * Inputs hold text exactly as typed; parsing turns them into the API body (money in satang).
 */

export interface ProductFormValues {
  barcode: string;
  name: string;
  categoryId: string | null;
  sku: string;
  price: string;
  cost: string;
  startingStock: string;
  lowStockAt: string;
}

export type ProductField = keyof ProductFormValues;
export type ProductFormErrors = Partial<Record<ProductField, string>>;

export type ParseResult =
  { ok: true; data: ProductCreateInput } | { ok: false; errors: ProductFormErrors };

export function emptyProductForm(defaults: {
  barcode?: string;
  categoryId?: string | null;
  lowStockAt?: number | null;
}): ProductFormValues {
  return {
    barcode: defaults.barcode ?? "",
    name: "",
    categoryId: defaults.categoryId ?? null,
    sku: "",
    price: "",
    cost: "",
    startingStock: "0",
    lowStockAt: defaults.lowStockAt == null ? "" : String(defaults.lowStockAt),
  };
}

export function productToForm(product: Product): ProductFormValues {
  return {
    barcode: product.barcode ?? "",
    name: product.name,
    categoryId: product.category?.id ?? null,
    sku: product.sku ?? "",
    price: satangToInput(product.price),
    cost: product.cost === null ? "" : satangToInput(product.cost),
    startingStock: String(product.stockQty),
    lowStockAt: product.lowStockAt === null ? "" : String(product.lowStockAt),
  };
}

const MONEY_HINT = "Enter an amount like 12.50";
const COUNT_HINT = "Enter a whole number, like 12";

/** "" → null; "12" → 12; anything else → an error message. */
function parseCount(text: string): number | null | string {
  const trimmed = text.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : COUNT_HINT;
}

function parseMoney(text: string): number | null | string {
  if (text.trim() === "") return null;
  return parseThb(text) ?? MONEY_HINT;
}

/**
 * Check the form with the same schema the API uses.
 * `startingStock` is only checked when adding (on Edit, stock changes through Restock / Adjust).
 */
export function parseProductForm(values: ProductFormValues, mode: "create" | "edit"): ParseResult {
  const errors: ProductFormErrors = {};
  const number = (field: ProductField, parsed: number | null | string) => {
    if (typeof parsed === "string") errors[field] = parsed;
    return typeof parsed === "number" ? parsed : null;
  };

  const candidate = {
    barcode: values.barcode,
    name: values.name,
    categoryId: values.categoryId,
    sku: values.sku,
    price: number("price", parseMoney(values.price)),
    cost: number("cost", parseMoney(values.cost)),
    lowStockAt: number("lowStockAt", parseCount(values.lowStockAt)),
    startingStock:
      mode === "create" ? number("startingStock", parseCount(values.startingStock)) : 0,
  };

  const result = productCreateSchema.safeParse(candidate);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as ProductField;
      errors[field] ??=
        field === "price" && candidate.price === null ? "Enter the selling price" : issue.message;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Send what was typed (numbers parsed); the API cleans it up with the same schema.
  return { ok: true, data: candidate as ProductCreateInput };
}

/** Only the fields that differ from the saved product, for PATCH. Empty object = nothing to save. */
export function changedFields(product: Product, data: ProductCreateInput): ProductUpdateInput {
  const next = productCreateSchema.parse(data); // cleaned up the same way the API will
  const saved = {
    barcode: product.barcode,
    name: product.name,
    categoryId: product.category?.id ?? null,
    sku: product.sku,
    price: product.price,
    cost: product.cost,
    lowStockAt: product.lowStockAt,
  };
  const changes: ProductUpdateInput = {};
  for (const key of Object.keys(saved) as (keyof typeof saved)[]) {
    if (next[key] !== saved[key]) Object.assign(changes, { [key]: data[key] });
  }
  return changes;
}

/** Field errors sent by the API (400 validation or 409 duplicate) → form errors. */
export function serverFieldErrors(error: unknown): ProductFormErrors | null {
  if (!isApiError(error) || !error.issues?.length) return null;
  const errors: ProductFormErrors = {};
  for (const issue of error.issues as ApiErrorIssue[]) {
    const field = issue.path[0];
    if (typeof field === "string" && isProductField(field)) errors[field] ??= issue.message;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

const FIELDS: readonly ProductField[] = [
  "barcode",
  "name",
  "categoryId",
  "sku",
  "price",
  "cost",
  "startingStock",
  "lowStockAt",
];

function isProductField(value: string): value is ProductField {
  return (FIELDS as readonly string[]).includes(value);
}

/** True when the form differs from where it started (asks before throwing work away). */
export function isDirty(values: ProductFormValues, initial: ProductFormValues): boolean {
  return FIELDS.some((field) => values[field] !== initial[field]);
}
