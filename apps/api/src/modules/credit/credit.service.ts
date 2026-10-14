import {
  bangkokDateKey,
  bangkokDayRange,
  customerNameKey,
  formatTHB,
  oldestUnpaidAt,
  type CreditBoard,
  type CustomerDetail,
  type customerInputSchema,
  type CustomerSummary,
  type customerSearchSchema,
  type RepaymentResult,
  type repaymentInputSchema,
} from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { Db } from "../../lib/db";
import { HttpError } from "../../lib/http-error";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";

export type CustomerSearch = z.output<typeof customerSearchSchema>;
export type CustomerInput = z.output<typeof customerInputSchema>;
export type RepaymentInput = z.output<typeof repaymentInputSchema>;

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

// ---------- Credit page ----------

const customerGone = () => HttpError.notFound("This customer doesn't exist any more.");
const nameTaken = (name: string) =>
  HttpError.duplicate("name", `There's already a customer called "${name}".`);

/** Every customer with balance and debt age, plus the stat cards (plan.md → Credit page). */
export async function getBoard(now = new Date()): Promise<CreditBoard> {
  const [customers, entries] = await Promise.all([
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.creditEntry.findMany({
      select: { customerId: true, type: true, amount: true, orderId: true, createdAt: true },
    }),
  ]);

  const byCustomer = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byCustomer.get(entry.customerId) ?? [];
    list.push(entry);
    byCustomer.set(entry.customerId, list);
  }

  const today = bangkokDayRange(bangkokDateKey(now));
  let collectedToday = 0;
  let collectedTodayCount = 0;
  for (const entry of entries) {
    if (
      entry.type === "REPAYMENT" &&
      entry.createdAt >= today.start &&
      entry.createdAt < today.end
    ) {
      collectedToday += entry.amount;
      collectedTodayCount += 1;
    }
  }

  const overview = customers.map((customer) => {
    const own = byCustomer.get(customer.id) ?? [];
    const balance = own.reduce((sum, e) => sum + (e.type === "CHARGE" ? e.amount : -e.amount), 0);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      balance,
      oldestUnpaidAt: oldestUnpaidAt(
        own.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      ),
    };
  });
  const owing = overview.filter((customer) => customer.balance > 0);

  return {
    customers: overview,
    stats: {
      totalOwed: owing.reduce((sum, customer) => sum + customer.balance, 0),
      owingCount: owing.length,
      collectedToday,
      collectedTodayCount,
    },
  };
}

/** One customer with their history, newest first, and the balance after each entry. */
export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      creditEntries: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          order: { select: { id: true, billNo: true } },
          user: { select: { displayName: true } },
        },
      },
    },
  });
  if (!customer) throw customerGone();

  let running = 0;
  const history = customer.creditEntries.map((entry) => {
    const signed = entry.type === "CHARGE" ? entry.amount : -entry.amount;
    running += signed;
    return {
      id: entry.id,
      type: entry.type,
      amount: signed,
      method: entry.method,
      order: entry.order,
      note: entry.note,
      userName: entry.user.displayName,
      createdAt: entry.createdAt.toISOString(),
      balanceAfter: running,
    };
  });
  const charges = customer.creditEntries.filter((entry) => entry.type === "CHARGE");
  const oldest = oldestUnpaidAt(
    history.map((h) => ({ ...h, amount: Math.abs(h.amount), orderId: h.order?.id ?? null })),
  );

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    balance: running,
    firstChargeAt: charges[0]?.createdAt.toISOString() ?? null,
    creditBillCount: charges.length,
    oldestUnpaidAt: oldest,
    history: history.reverse(),
  };
}

/** "+ Add customer". Names are unique ignoring case and spaces. */
export async function createCustomer(
  input: CustomerInput,
  ctx: RequestContext,
): Promise<CustomerSummary> {
  return prisma.$transaction(async (tx) => {
    const nameKey = customerNameKey(input.name);
    const existing = await tx.customer.findUnique({ where: { nameKey } });
    if (existing) throw nameTaken(existing.name);

    const customer = await tx.customer.create({ data: { ...input, nameKey } });
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "CUSTOMER_CREATE",
        entityType: "Customer",
        entityId: customer.id,
        after: { ...input },
      },
      ctx.meta,
    );
    return { id: customer.id, name: customer.name, phone: customer.phone, balance: 0 };
  });
}

/** Edit name, phone or note (CUSTOMER_UPDATE with only what changed). */
export async function updateCustomer(
  id: string,
  input: CustomerInput,
  ctx: RequestContext,
): Promise<CustomerSummary> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.customer.findUnique({ where: { id } });
    if (!before) throw customerGone();
    const nameKey = customerNameKey(input.name);
    const clash = await tx.customer.findFirst({ where: { nameKey, id: { not: id } } });
    if (clash) throw nameTaken(clash.name);

    const after = await tx.customer.update({ where: { id }, data: { ...input, nameKey } });
    const changed = (["name", "phone", "note"] as const).filter(
      (key) => before[key] !== after[key],
    );
    if (changed.length > 0) {
      await writeAudit(
        tx,
        ctx.actor,
        {
          action: "CUSTOMER_UPDATE",
          entityType: "Customer",
          entityId: id,
          before: Object.fromEntries(changed.map((key) => [key, before[key]])),
          after: Object.fromEntries(changed.map((key) => [key, after[key]])),
        },
        ctx.meta,
      );
    }
    return { id: after.id, name: after.name, phone: after.phone, balance: await balanceOf(tx, id) };
  });
}

/**
 * Record a payment (plan.md → Record payment). Partial is fine; more than they owe is not.
 * The customer row is locked so two payments at once can't both pass the check.
 */
export async function recordRepayment(
  input: RepaymentInput,
  ctx: RequestContext,
): Promise<RepaymentResult> {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ name: string }[]>`
      SELECT name FROM "Customer" WHERE id = ${input.customerId} FOR UPDATE`;
    if (!locked) throw customerGone();

    const before = await balanceOf(tx, input.customerId);
    if (before <= 0) throw HttpError.badRequest(`${locked.name} doesn't owe anything right now.`);
    if (input.amount > before) {
      const message = `Can't be more than what they owe (${formatTHB(before)}).`;
      throw new HttpError(400, "VALIDATION", message, [{ path: ["amount"], message }]);
    }

    const entry = await tx.creditEntry.create({
      data: {
        customerId: input.customerId,
        type: "REPAYMENT",
        amount: input.amount,
        method: input.method,
        note: input.note,
        userId: ctx.actor.userId,
      },
    });
    const after = before - input.amount;
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "CREDIT_REPAYMENT",
        entityType: "CreditEntry",
        entityId: entry.id,
        after: {
          customer: locked.name,
          amount: input.amount,
          method: input.method,
          balanceBefore: before,
          balanceAfter: after,
        },
        reason: input.note,
      },
      ctx.meta,
    );
    return { balanceBefore: before, balanceAfter: after };
  });
}
