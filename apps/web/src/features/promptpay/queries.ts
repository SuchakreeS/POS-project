import type { PromptPayBill, PromptPayBoard, PromptPaySummary } from "@pos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const promptpayKeys = {
  all: ["promptpay"] as const,
  board: ["promptpay", "board"] as const,
  summary: ["promptpay", "summary"] as const,
};

/** Pending + received today. Refreshes every 30 s so bills from other tills show up. */
export function usePromptPayBoard() {
  return useQuery({
    queryKey: promptpayKeys.board,
    queryFn: ({ signal }) => api.get<PromptPayBoard>("/promptpay", { signal }),
    refetchInterval: 30_000,
  });
}

/** Pending count for the sidebar badge. */
export function usePromptPayPendingCount(): number | undefined {
  const { data } = useQuery({
    queryKey: promptpayKeys.summary,
    queryFn: ({ signal }) => api.get<PromptPaySummary>("/promptpay/summary", { signal }),
    refetchInterval: 60_000,
  });
  return data?.pendingCount;
}

function useRefreshPromptPay() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: promptpayKeys.all });
}

export function useMarkReceived() {
  const refresh = useRefreshPromptPay();
  return useMutation({
    mutationFn: (orderIds: string[]) =>
      api
        .post<{ items: PromptPayBill[] }>("/promptpay/receive", { orderIds })
        .then((res) => res.items),
    onSettled: refresh,
  });
}

export function useUndoReceived() {
  const refresh = useRefreshPromptPay();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.post<PromptPayBill>(`/promptpay/${orderId}/undo`, { reason }),
    onSettled: refresh,
  });
}
