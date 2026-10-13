import { IDEMPOTENCY_HEADER, type CheckoutInput, type Order } from "@pos/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogKeys } from "@/features/catalog/queries";
import { inventoryKeys } from "@/features/inventory/queries";
import { api } from "@/lib/api";

export interface CheckoutRequest {
  input: CheckoutInput;
  /** One per payment attempt: retrying with the same key can never make a second bill. */
  idempotencyKey: string;
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CheckoutRequest) =>
      api.post<Order>("/orders", input, { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } }),
    onSuccess: () => {
      // Stock went down: refresh badges and history in the background.
      void queryClient.invalidateQueries({ queryKey: catalogKeys.products });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.allMovements });
    },
  });
}
