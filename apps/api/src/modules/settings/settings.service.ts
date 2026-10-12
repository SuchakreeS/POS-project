import type { ShopSettings } from "@pos/shared";
import { prisma } from "../../lib/prisma";

const SETTINGS_ID = 1;

/** The single settings row. Created with defaults if the seed hasn't run. */
export async function getShopSettings(): Promise<ShopSettings> {
  const row = await prisma.shopSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return {
    shopName: row.shopName,
    shopPhone: row.shopPhone,
    reportTime: row.reportTime,
    sendReportToLine: row.sendReportToLine,
    defaultLowStockAt: row.defaultLowStockAt,
  };
}
