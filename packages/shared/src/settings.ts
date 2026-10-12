/** Shop settings (single row, edited on the Settings page — plan.md → Settings). */
export interface ShopSettings {
  shopName: string;
  shopPhone: string | null;
  /** "HH:mm", Bangkok time. */
  reportTime: string;
  sendReportToLine: boolean;
  /** Pre-fills "Low-stock alert" in Add new item. */
  defaultLowStockAt: number;
}
