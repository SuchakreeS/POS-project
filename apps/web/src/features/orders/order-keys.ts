import type { OrderFilter } from "@pos/shared";
import type { DateRange } from "@/lib/datetime";

/** Query keys for bills. Kept apart from queries.ts so other features can refresh bills without an import cycle. */
export const orderKeys = {
  all: ["orders"] as const,
  list: (query: OrderListParams) => ["orders", "list", query] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};

export interface OrderListParams extends DateRange {
  search: string;
  filter: OrderFilter;
}
