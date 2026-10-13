import type {
  Category,
  CategoryInput,
  CategoryList,
  Product,
  ProductCreateInput,
  ProductList,
  ProductUpdateInput,
} from "@pos/shared";
import { api } from "@/lib/api";

/** Thin wrappers around the /products and /categories endpoints (apps/api/src/modules). */
export const catalogApi = {
  /** Every product, active and turned off. The Stock page filters on the client (fine for a few hundred items). */
  listAllProducts: (signal?: AbortSignal) =>
    api.get<ProductList>("/products?status=all", { signal }).then((list) => list.items),

  getProduct: (id: string, signal?: AbortSignal) => api.get<Product>(`/products/${id}`, { signal }),

  /** Exact barcode (404 if unknown). */
  getByBarcode: (barcode: string) =>
    api.get<Product>(`/products/barcode/${encodeURIComponent(barcode)}`),

  createProduct: (input: ProductCreateInput) => api.post<Product>("/products", input),

  updateProduct: (id: string, input: ProductUpdateInput) =>
    api.patch<Product>(`/products/${id}`, input),

  setProductActive: (id: string, active: boolean) =>
    api.post<Product>(`/products/${id}/${active ? "reactivate" : "deactivate"}`, {}),

  listCategories: (signal?: AbortSignal) =>
    api.get<CategoryList>("/categories", { signal }).then((list) => list.items),

  createCategory: (input: CategoryInput) => api.post<Category>("/categories", input),
};
