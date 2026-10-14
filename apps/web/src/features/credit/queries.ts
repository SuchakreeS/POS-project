import type {
  CreditBoard,
  CustomerDetail,
  CustomerInput,
  CustomerList,
  CustomerSummary,
  RepaymentInput,
  RepaymentResult,
} from "@pos/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const creditKeys = {
  all: ["credit"] as const,
  board: ["credit", "board"] as const,
  customer: (id: string) => ["credit", "customer", id] as const,
  customers: (search: string) => ["credit", "customers", search] as const,
};

/** Customers matching a name or phone, with what they owe (checkout autocomplete). */
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

/** Every customer with balance and debt age, plus the stat cards. */
export function useCreditBoard() {
  return useQuery({
    queryKey: creditKeys.board,
    queryFn: ({ signal }) => api.get<CreditBoard>("/credit", { signal }),
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery({
    queryKey: creditKeys.customer(id ?? ""),
    queryFn: ({ signal }) => api.get<CustomerDetail>(`/credit/customers/${id}`, { signal }),
    enabled: Boolean(id),
  });
}

/** Everything about credit changes together (board, history, autocomplete balances). */
function useCreditChanged() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: creditKeys.all });
}

export function useSaveCustomer(id: string | null) {
  const changed = useCreditChanged();
  return useMutation({
    mutationFn: (input: CustomerInput) =>
      id
        ? api.patch<CustomerSummary>(`/credit/customers/${id}`, input)
        : api.post<CustomerSummary>("/credit/customers", input),
    onSuccess: changed,
  });
}

export function useRecordRepayment() {
  const changed = useCreditChanged();
  return useMutation({
    mutationFn: (input: RepaymentInput) => api.post<RepaymentResult>("/credit/repayments", input),
    onSuccess: changed,
  });
}
