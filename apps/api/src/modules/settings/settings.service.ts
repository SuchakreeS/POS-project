import type { ShopSettings, shopSettingsInputSchema } from "@pos/shared";
import type { z } from "zod";
import { writeAudit } from "../../audit/audit";
import type { ShopSetting } from "../../generated/prisma/client";
import type { Db } from "../../lib/db";
import { prisma } from "../../lib/prisma";
import type { RequestContext } from "../../lib/request-context";

export type ShopSettingsInput = z.output<typeof shopSettingsInputSchema>;

const SETTINGS_ID = 1;
/** Compared one by one for the audit entry. */
const FIELDS = [
  "shopName",
  "shopPhone",
  "reportTime",
  "sendReportToLine",
  "defaultLowStockAt",
] as const satisfies readonly (keyof ShopSettings)[];

function toShopSettings(row: ShopSetting): ShopSettings {
  return {
    shopName: row.shopName,
    shopPhone: row.shopPhone,
    reportTime: row.reportTime,
    sendReportToLine: row.sendReportToLine,
    defaultLowStockAt: row.defaultLowStockAt,
  };
}

/** The single settings row. Created with defaults if the seed hasn't run. */
async function settingsRow(db: Db): Promise<ShopSetting> {
  return db.shopSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function getShopSettings(): Promise<ShopSettings> {
  return toShopSettings(await settingsRow(prisma));
}

/** Save the Settings form. SETTINGS_UPDATE lists only what changed (before → after). */
export async function updateShopSettings(
  input: ShopSettingsInput,
  ctx: RequestContext,
): Promise<ShopSettings> {
  return prisma.$transaction(async (tx) => {
    const before = toShopSettings(await settingsRow(tx));
    const changed = FIELDS.filter((field) => before[field] !== input[field]);
    if (changed.length === 0) return before;

    const after = toShopSettings(
      await tx.shopSetting.update({ where: { id: SETTINGS_ID }, data: input }),
    );
    await writeAudit(
      tx,
      ctx.actor,
      {
        action: "SETTINGS_UPDATE",
        entityType: "ShopSetting",
        entityId: String(SETTINGS_ID),
        before: Object.fromEntries(changed.map((field) => [field, before[field]])),
        after: Object.fromEntries(changed.map((field) => [field, after[field]])),
      },
      ctx.meta,
    );
    return after;
  });
}
