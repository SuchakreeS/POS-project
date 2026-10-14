import type { Terminal, TerminalInput, TerminalList } from "@pos/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { thisTerminal } from "./terminals";
import { useThisPc } from "./this-pc";

export const terminalKeys = { all: ["terminals"] as const };

export function useTerminals() {
  return useQuery({
    queryKey: terminalKeys.all,
    queryFn: ({ signal }) =>
      api.get<TerminalList>("/terminals", { signal }).then((list) => list.items),
    staleTime: 10 * 60_000,
  });
}

/** This PC's terminal for checkout, or why there isn't one. */
export function useThisTerminal() {
  const terminals = useTerminals();
  const pickedId = useThisPc((state) => state.terminalId);
  return {
    ...terminals,
    current: terminals.data ? thisTerminal(terminals.data, pickedId) : null,
  };
}

export function useAddTerminal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TerminalInput) => api.post<Terminal>("/terminals", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: terminalKeys.all }),
  });
}
