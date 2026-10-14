import type { Order, OrderPage, VoidInput } from "@pos/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { catalogKeys } from "@/features/catalog/queries";
import { creditKeys } from "@/features/credit/queries";
import { inventoryKeys } from "@/features/inventory/queries";
import { promptpayKeys } from "@/features/promptpay/queries";
import { api } from "@/lib/api";
import { orderKeys, type OrderListParams } from "./order-keys";

const PAGE_SIZE = 50;

/** Bills for the Orders page, newest first, loading older pages on demand. */
export function useOrders(params: OrderListParams) {
  return useInfiniteQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ ...params, limit: String(PAGE_SIZE) });
      if (pageParam) query.set("cursor", pageParam);
      return api.get<OrderPage>(`/orders?${query}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    // Keep the old rows on screen while a new search or filter loads (no flash of skeletons).
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: ({ signal }) => api.get<Order>(`/orders/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

/** Void touches stock, credit and PromptPay too, so all of those refresh. */
export function useVoidOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VoidInput) => api.post<Order>(`/orders/${id}/void`, input),
    onSuccess: (order) => queryClient.setQueryData(orderKeys.detail(order.id), order),
    onSettled: () => {
      for (const queryKey of [
        orderKeys.all,
        catalogKeys.products,
        inventoryKeys.allMovements,
        promptpayKeys.all,
        creditKeys.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
