import { IDEMPOTENCY_HEADER, type CheckoutInput, type CheckoutResponse } from "@pos/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogKeys } from "@/features/catalog/queries";
import { creditKeys } from "@/features/credit/queries";
import { inventoryKeys } from "@/features/inventory/queries";
import { orderKeys } from "@/features/orders/order-keys";
import { promptpayKeys } from "@/features/promptpay/queries";
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
      api.post<CheckoutResponse>("/orders", input, {
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      }),
    onSuccess: () => {
      // Stock went down: refresh badges and history in the background.
      void queryClient.invalidateQueries({ queryKey: catalogKeys.products });
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.allMovements });
      void queryClient.invalidateQueries({ queryKey: promptpayKeys.all }); // pending badge
      void queryClient.invalidateQueries({ queryKey: creditKeys.all }); // balances
      void queryClient.invalidateQueries({ queryKey: orderKeys.all }); // Orders page
    },
  });
}
