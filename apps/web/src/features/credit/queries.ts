import type { CustomerList, CustomerSummary } from "@pos/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const creditKeys = {
  all: ["credit"] as const,
  customers: (search: string) => ["credit", "customers", search] as const,
};

/** Customers matching a name or phone, with what they owe. */
export function useCustomerSearch(search: string, { enabled = true, limit = 8 } = {}) {
  return useQuery<CustomerSummary[]>({
    queryKey: [...creditKeys.customers(search), limit],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ search, limit: String(limit) });
      return api
        .get<CustomerList>(`/credit/customers?${params}`, { signal })
        .then((list) => list.items);
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}
