import { customerNameKey, type CustomerSummary, type customerSearchSchema } from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";

export type CustomerSearch = z.output<typeof customerSearchSchema>;

/**
 * What each customer owes: CHARGE − REPAYMENT − CHARGE_VOID (plan.md → Credit).
 * Customers without entries owe 0.
 */
export async function balancesOf(
  db: Db,
  customerIds: readonly string[],
): Promise<Map<string, number>> {
  const balances = new Map(customerIds.map((id) => [id, 0]));
  if (customerIds.length === 0) return balances;

  const sums = await db.creditEntry.groupBy({
    by: ["customerId", "type"],
    where: { customerId: { in: [...customerIds] } },
    _sum: { amount: true },
  });
  for (const { customerId, type, _sum } of sums) {
    const amount = _sum.amount ?? 0;
    const signed = type === "CHARGE" ? amount : -amount;
    balances.set(customerId, (balances.get(customerId) ?? 0) + signed);
  }
  return balances;
}

export async function balanceOf(db: Db, customerId: string): Promise<number> {
  return (await balancesOf(db, [customerId])).get(customerId) ?? 0;
}

/** Name or phone search, with balances (checkout autocomplete; the Credit page in step 8). */
export async function listCustomers(query: CustomerSearch): Promise<CustomerSummary[]> {
  const search = query.search || undefined;
  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [{ nameKey: { contains: customerNameKey(search) } }, { phone: { contains: search } }],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: query.limit,
  });
  const balances = await balancesOf(
    prisma,
    customers.map((c) => c.id),
  );
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    balance: balances.get(c.id) ?? 0,
  }));
}

/**
 * The customer for a credit sale: an existing one by id, or by name — reusing a customer whose
 * name matches ignoring case and spaces, else creating one (CUSTOMER_CREATE).
 */
export async function resolveCustomer(
  tx: Db,
  customer: { id: string } | { newName: string },
  ctx: RequestContext,
) {
  if ("id" in customer) {
    const found = await tx.customer.findUnique({ where: { id: customer.id } });
    if (!found)
      throw HttpError.badRequest("That customer doesn't exist any more. Pick another one.");
    return found;
  }

  const nameKey = customerNameKey(customer.newName);
  const existing = await tx.customer.findUnique({ where: { nameKey } });
  if (existing) return existing;

  const created = await tx.customer.create({ data: { name: customer.newName, nameKey } });
  await writeAudit(
    tx,
    ctx.actor,
    {
      action: "CUSTOMER_CREATE",
      entityType: "Customer",
      entityId: created.id,
      after: { name: created.name },
    },
    ctx.meta,
  );
  return created;
}
