import type { ShopSettings, ShopSettingsInput } from "@pos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const settingsKeys = { shop: ["settings"] as const };

export function useShopSettings() {
  return useQuery({
    queryKey: settingsKeys.shop,
    queryFn: ({ signal }) => api.get<ShopSettings>("/settings", { signal }),
    staleTime: 5 * 60_000,
  });
}

/** Save the Settings form (admin only). The saved values replace the cached ones at once. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ShopSettingsInput) => api.patch<ShopSettings>("/settings", input),
    onSuccess: (saved) => queryClient.setQueryData(settingsKeys.shop, saved),
  });
}
