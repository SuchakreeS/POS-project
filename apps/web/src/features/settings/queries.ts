import type { ShopSettings } from "@pos/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const settingsKeys = { shop: ["settings"] as const };

export function useShopSettings() {
  return useQuery({
    queryKey: settingsKeys.shop,
    queryFn: ({ signal }) => api.get<ShopSettings>("/settings", { signal }),
    staleTime: 5 * 60_000,
  });
}
