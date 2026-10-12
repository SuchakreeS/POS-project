import type { Category } from "@pos/shared";
import { writeAudit } from "../../audit/audit";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import { isUniqueViolation } from "../../lib/prisma-errors";
import type { RequestContext } from "../../lib/request-context";

const duplicateName = (name: string) =>
  HttpError.duplicate("name", `There's already a category called "${name}".`);

/** Names are unique ignoring case and spacing ("Drinks" = "drinks "). Names arrive normalised by the schema. */
async function assertNameFree(db: Db, name: string, exceptId?: string) {
  const existing = await db.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId && { id: { not: exceptId } }),
    },
  });
  if (existing) throw duplicateName(existing.name);
}

export async function listCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products }));
}

export async function createCategory(name: string, ctx: RequestContext): Promise<Category> {
  try {
    return await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, name);
      const category = await tx.category.create({ data: { name } });
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "CATEGORY_CREATE",
          entityType: "Category",
          entityId: category.id,
          after: { name },
        },
        ctx.meta,
      );
      return { id: category.id, name: category.name, productCount: 0 };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName(name);
    throw error;
  }
}

export async function renameCategory(
  id: string,
  name: string,
  ctx: RequestContext,
): Promise<Category> {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUnique({ where: { id } });
      if (!before) throw HttpError.notFound("This category doesn't exist any more.");
      await assertNameFree(tx, name, id);

      const category = await tx.category.update({
        where: { id },
        data: { name },
        include: { _count: { select: { products: { where: { isActive: true } } } } },
      });
      if (before.name !== name) {
        await writeAudit(
          tx,
          ctx.actor,
          {
            action: "CATEGORY_UPDATE",
            entityType: "Category",
            entityId: id,
            before: { name: before.name },
            after: { name },
          },
          ctx.meta,
        );
      }
      return { id: category.id, name: category.name, productCount: category._count.products };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName(name);
    throw error;
  }
}
