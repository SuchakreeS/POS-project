import type {
  Product,
  productCreateSchema,
  productListQuerySchema,
  productUpdateSchema,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Prisma } from "../../generated/prisma/client";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";
import {
  auditSnapshot,
  DETAIL_KEYS,
  diffSnapshots,
  PRICE_KEYS,
  productInclude,
  toProduct,
} from "./product.mapper";
import { nextAutoSku } from "./sku";

export type ProductListQuery = z.output<typeof productListQuerySchema>;
export type ProductCreate = z.output<typeof productCreateSchema>;
export type ProductUpdate = z.output<typeof productUpdateSchema>;

const notFound = () => HttpError.notFound("This item doesn't exist any more.");
const raced = () =>
  HttpError.conflict(
    "Another item was saved with the same barcode or SKU just now. Please try again.",
  );

// ---------- Reads ----------

export async function listProducts(query: ProductListQuery): Promise<Product[]> {
  const search = query.search || undefined;
  const where: Prisma.ProductWhereInput = {
    ...(query.status !== "all" && { isActive: query.status === "active" }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { startsWith: search } },
      ],
    }),
  };
  const rows = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(toProduct);
}

export async function getProduct(id: string): Promise<Product> {
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!row) throw notFound();
  return toProduct(row);
}

/** Exact barcode match, for scanning. Inactive items are returned too; the caller decides. */
export async function findByBarcode(barcode: string): Promise<Product> {
  const row = await prisma.product.findUnique({ where: { barcode }, include: productInclude });
  if (!row) throw HttpError.notFound(`Barcode not found — ${barcode} isn't in the system yet.`);
  return toProduct(row);
}

// ---------- Checks shared by create and update ----------

async function assertUnique(
  db: Db,
  fields: { barcode?: string | null; sku?: string | null },
  exceptId?: string,
) {
  const notSelf = exceptId ? { id: { not: exceptId } } : {};
  if (fields.barcode) {
    const other = await db.product.findFirst({ where: { barcode: fields.barcode, ...notSelf } });
    if (other)
      throw HttpError.duplicate("barcode", `This barcode is already used by "${other.name}".`);
  }
  if (fields.sku) {
    const other = await db.product.findFirst({
      where: { sku: { equals: fields.sku, mode: "insensitive" }, ...notSelf },
    });
    if (other) throw HttpError.duplicate("sku", `This SKU is already used by "${other.name}".`);
  }
}

async function assertCategoryExists(db: Db, categoryId: string | null | undefined) {
  if (!categoryId) return;
  if (!(await db.category.findUnique({ where: { id: categoryId } }))) {
    throw HttpError.badRequest("That category doesn't exist any more. Pick another one.");
  }
}

// ---------- Writes ----------

/**
 * Add new item: product, its starting stock (INITIAL movement) and PRODUCT_CREATE, in one transaction
 * (plan.md → Business rules → Stock). Starting stock 0 creates no movement.
 */
export async function createProduct(input: ProductCreate, ctx: RequestContext): Promise<Product> {
  const { startingStock, ...fields } = input;
  try {
    const row = await prisma.$transaction(async (tx) => {
      await assertUnique(tx, fields);
      await assertCategoryExists(tx, fields.categoryId);

      const product = await tx.product.create({
        data: { ...fields, sku: fields.sku ?? (await nextAutoSku(tx)), stockQty: startingStock },
        include: productInclude,
      });
      if (startingStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: "INITIAL",
            qty: startingStock,
            userId: ctx.actor.userId,
          },
        });
      }
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "PRODUCT_CREATE",
          entityType: "Product",
          entityId: product.id,
          after: { ...auditSnapshot(product), startingStock },
        },
        ctx.meta,
      );
      return product;
    });
    return toProduct(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw raced();
    throw error;
  }
}

/**
 * Edit item. Price or cost changes are logged as PRICE_CHANGE, everything else as PRODUCT_UPDATE,
 * each with only the fields that changed. Stock is not editable here.
 */
export async function updateProduct(
  id: string,
  input: ProductUpdate,
  ctx: RequestContext,
): Promise<Product> {
  try {
    const row = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id }, include: productInclude });
      if (!before) throw notFound();
      await assertUnique(tx, input, id);
      await assertCategoryExists(tx, input.categoryId);

      const after = await tx.product.update({
        where: { id },
        data: { ...input, sku: input.sku === null ? await nextAutoSku(tx) : input.sku },
        include: productInclude,
      });

      const audit = (
        action: "PRICE_CHANGE" | "PRODUCT_UPDATE",
        keys: typeof PRICE_KEYS | typeof DETAIL_KEYS,
      ) => {
        const diff = diffSnapshots(auditSnapshot(before), auditSnapshot(after), keys);
        return (
          diff &&
          writeAudit(
            tx,
            ctx.actor,
            { action, entityType: "Product", entityId: id, ...diff },
            ctx.meta,
          )
        );
      };
      await audit("PRICE_CHANGE", PRICE_KEYS);
      await audit("PRODUCT_UPDATE", DETAIL_KEYS);
      return after;
    });
    return toProduct(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw raced();
    throw error;
  }
}

/** Deactivate (hide from checkout, keep all history) or turn back on. Doing it twice is a no-op. */
export async function setProductActive(
  id: string,
  isActive: boolean,
  reason: string | null | undefined,
  ctx: RequestContext,
): Promise<Product> {
  const row = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id }, include: productInclude });
    if (!before) throw notFound();
    if (before.isActive === isActive) return before;

    const after = await tx.product.update({
      where: { id },
      data: { isActive },
      include: productInclude,
    });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: isActive ? "PRODUCT_REACTIVATE" : "PRODUCT_DEACTIVATE",
        entityType: "Product",
        entityId: id,
        after: { name: after.name, sku: after.sku },
        reason: reason ?? null,
      },
      ctx.meta,
    );
    return after;
  });
  return toProduct(row);
}
