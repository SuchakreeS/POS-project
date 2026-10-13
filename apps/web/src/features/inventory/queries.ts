import type {
  AdjustInput,
  MovementFilter,
  MovementPage,
  Product,
  ProductList,
  RestockInput,
} from "@pos/shared";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { storeProducts } from "@/features/catalog/queries";
import { api } from "@/lib/api";

export const inventoryKeys = {
  movements: (productId: string, filter: MovementFilter) =>
    ["movements", productId, filter] as const,
  allMovements: ["movements"] as const,
};

/** After stock changes: update product caches and drop stale movement history. */
function useStockChanged() {
  const queryClient = useQueryClient();
  return (products: readonly Product[]) => {
    storeProducts(queryClient, products);
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.allMovements });
  };
}

export function useRestock() {
  const stockChanged = useStockChanged();
  return useMutation({
    mutationFn: (input: RestockInput) => api.post<ProductList>("/inventory/restock", input),
    onSuccess: (result) => stockChanged(result.items),
  });
}

export function useAdjustStock() {
  const stockChanged = useStockChanged();
  return useMutation({
    mutationFn: (input: AdjustInput) => api.post<Product>("/inventory/adjust", input),
    onSuccess: (product) => stockChanged([product]),
  });
}

const PAGE_SIZE = 50;

/** Movement history, newest first, loading older pages on demand. */
export function useMovements(productId: string, filter: MovementFilter) {
  return useInfiniteQuery({
    queryKey: inventoryKeys.movements(productId, filter),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ productId, filter, limit: String(PAGE_SIZE) });
      if (pageParam) params.set("cursor", pageParam);
      return api.get<MovementPage>(`/inventory/movements?${params}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
