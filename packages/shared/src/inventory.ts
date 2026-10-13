import { z } from "zod";
import { MAX_STOCK_QTY } from "./catalog";

/*
 * Restock, Adjust stock and Movement history (plan.md → Restock modal, Adjust stock dialog,
 * Movement history dialog). Stock only ever changes through these movements.
 */

/** Most products in one restock. */
export const MAX_RESTOCK_ROWS = 200;
export const NOTE_MAX = 200;

const qtySchema = z
  .number({ error: "Enter a quantity" })
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(MAX_STOCK_QTY, "Quantity is too large");

const noteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(NOTE_MAX, "Note is too long").nullable().default(null),
);

// ---------- Restock ----------

export const restockInputSchema = z.object({
  items: z
    .array(z.object({ productId: z.uuid(), qty: qtySchema }))
    .min(1, "Add at least one item")
    .max(MAX_RESTOCK_ROWS, `Restock at most ${MAX_RESTOCK_ROWS} items at a time`),
  /** Supplier / invoice number; saved on every movement. */
  note: noteSchema,
});
export type RestockInput = z.input<typeof restockInputSchema>;

// ---------- Adjust ----------

export const ADJUST_MODES = ["REMOVE", "ADD", "SET"] as const;
export type AdjustMode = (typeof ADJUST_MODES)[number];

/** The reason chips for each mode. "Set count" always saves "Count correction". */
export const ADJUST_REASONS = {
  REMOVE: ["Damaged", "Expired", "Lost or stolen", "Used in store", "Other"],
  ADD: ["Found extra", "Customer return", "Other"],
  SET: ["Count correction"],
} as const satisfies Record<AdjustMode, readonly string[]>;

export const adjustInputSchema = z
  .object({
    productId: z.uuid(),
    mode: z.enum(ADJUST_MODES),
    /** Remove / Add: how many. Set count: what was counted on the shelf (may be 0). */
    qty: z
      .number({ error: "Enter a quantity" })
      .int("Quantity must be a whole number")
      .min(0, "Quantity can't be negative")
      .max(MAX_STOCK_QTY, "Quantity is too large"),
    reason: z.string({ error: "Pick a reason" }).min(1, "Pick a reason"),
    note: noteSchema,
  })
  .superRefine((input, ctx) => {
    if (input.mode !== "SET" && input.qty < 1) {
      ctx.addIssue({ code: "custom", path: ["qty"], message: "Quantity must be at least 1" });
    }
    if (!(ADJUST_REASONS[input.mode] as readonly string[]).includes(input.reason)) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Pick a reason" });
    }
    if (input.reason === "Other" && !input.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Say what happened" });
    }
  });
export type AdjustInput = z.input<typeof adjustInputSchema>;

/** Signed stock change for an adjustment: Remove 3 → −3, Add 2 → +2, Set count 21 from 24 → −3. */
export function adjustDelta(mode: AdjustMode, qty: number, currentStock: number): number {
  if (mode === "REMOVE") return -qty;
  if (mode === "ADD") return qty;
  return qty - currentStock;
}

// ---------- Movement history ----------

export const MOVEMENT_TYPES = ["INITIAL", "SALE", "RESTOCK", "ADJUST", "VOID_RETURN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Filter pills in Movement history. Opening stock counts as stock coming in, with restocks. */
export const MOVEMENT_FILTERS = {
  all: MOVEMENT_TYPES,
  sales: ["SALE", "VOID_RETURN"],
  restock: ["RESTOCK", "INITIAL"],
  adjust: ["ADJUST"],
} as const satisfies Record<string, readonly MovementType[]>;
export type MovementFilter = keyof typeof MOVEMENT_FILTERS;

export const movementQuerySchema = z.object({
  productId: z.uuid(),
  filter: z
    .enum(Object.keys(MOVEMENT_FILTERS) as [MovementFilter, ...MovementFilter[]])
    .default("all"),
  /** From the previous page's `nextCursor`. */
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MovementQuery = z.input<typeof movementQuerySchema>;

export interface Movement {
  id: string;
  type: MovementType;
  /** Signed: −2 for a sale of 2, +24 for a restock. */
  qty: number;
  /** Stock right after this movement. */
  stockAfter: number;
  /** Adjust: "Damaged — 2 cans dented"; restock: supplier note. */
  reason: string | null;
  createdAt: string;
  userName: string;
  /** Sales and void returns link to their bill. */
  order: { id: string; billNo: string } | null;
}

export interface MovementPage {
  items: Movement[];
  /** Pass back as `cursor` to load older movements; null when there are none. */
  nextCursor: string | null;
}
