import type { Category, Product, ProductCreateInput, ProductUpdateInput } from "@pos/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { catalogApi } from "./catalog-api";

export const catalogKeys = {
  products: ["products"] as const,
  product: (id: string) => ["products", "detail", id] as const,
  categories: ["categories"] as const,
};

export function useProducts() {
  return useQuery({
    queryKey: catalogKeys.products,
    queryFn: ({ signal }) => catalogApi.listAllProducts(signal),
  });
}

/** One product. Starts from the list's copy (if loaded) so dialogs open instantly. */
export function useProduct(id: string | null) {
  const queryClient = useQueryClient();
  const fromList = queryClient
    .getQueryData<Product[]>(catalogKeys.products)
    ?.find((product) => product.id === id);
  return useQuery({
    queryKey: catalogKeys.product(id ?? ""),
    queryFn: ({ signal }) => catalogApi.getProduct(id ?? "", signal),
    enabled: Boolean(id),
    placeholderData: fromList,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: ({ signal }) => catalogApi.listCategories(signal),
  });
}

/** Put a saved product into the caches right away, then refetch lists in the background. */
function storeProduct(queryClient: QueryClient, product: Product) {
  queryClient.setQueryData(catalogKeys.product(product.id), product);
  queryClient.setQueryData<Product[]>(catalogKeys.products, (list) => {
    if (!list) return list;
    const index = list.findIndex((item) => item.id === product.id);
    return index === -1 ? [...list, product] : list.with(index, product);
  });
  void queryClient.invalidateQueries({ queryKey: catalogKeys.products });
  void queryClient.invalidateQueries({ queryKey: catalogKeys.categories }); // product counts
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductCreateInput) => catalogApi.createProduct(input),
    onSuccess: (product) => storeProduct(queryClient, product),
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductUpdateInput) => catalogApi.updateProduct(id, input),
    onSuccess: (product) => storeProduct(queryClient, product),
  });
}

export function useSetProductActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      catalogApi.setProductActive(id, active),
    onSuccess: (product) => storeProduct(queryClient, product),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => catalogApi.createCategory({ name }),
    onSuccess: (category) => {
      queryClient.setQueryData<Category[]>(catalogKeys.categories, (list) =>
        list ? [...list, category].sort((a, b) => a.name.localeCompare(b.name)) : list,
      );
      void queryClient.invalidateQueries({ queryKey: catalogKeys.categories });
    },
  });
}
