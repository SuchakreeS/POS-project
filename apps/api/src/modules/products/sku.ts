import type { Db } from "../../lib/db";

/** Automatic SKUs look like SKU-00001. Hand-typed SKUs can be anything else. */
const AUTO_PREFIX = "SKU-";
const AUTO_DIGITS = 5;
const AUTO_PATTERN = new RegExp(`^${AUTO_PREFIX}\\d{${AUTO_DIGITS}}$`);

export function formatAutoSku(n: number): string {
  return `${AUTO_PREFIX}${String(n).padStart(AUTO_DIGITS, "0")}`;
}

/** The next free automatic SKU: one more than the highest existing SKU-NNNNN. */
export async function nextAutoSku(db: Db): Promise<string> {
  const latest = await db.product.findFirst({
    where: { sku: { startsWith: AUTO_PREFIX } },
    orderBy: { sku: "desc" },
    select: { sku: true },
  });
  const last =
    latest?.sku && AUTO_PATTERN.test(latest.sku) ? Number(latest.sku.slice(AUTO_PREFIX.length)) : 0;
  return formatAutoSku(last + 1);
}
