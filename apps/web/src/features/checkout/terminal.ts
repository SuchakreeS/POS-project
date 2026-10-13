import type { Terminal, TerminalList } from "@pos/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/*
 * Which checkout device this PC is (bill numbers are per terminal: T1-000001).
 * Remembered per browser; Settings (step 10) lets an admin pick it. Until then: the first one.
 */

const STORAGE_KEY = "pos.terminalCode";

function savedCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked: fall back to the first terminal
  }
}

export function saveTerminalCode(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore: the choice just won't be remembered
  }
}

export function pickTerminal(terminals: readonly Terminal[], code: string | null): Terminal | null {
  return terminals.find((terminal) => terminal.code === code) ?? terminals[0] ?? null;
}

export function useTerminal() {
  const query = useQuery({
    queryKey: ["terminals"],
    queryFn: ({ signal }) =>
      api.get<TerminalList>("/terminals", { signal }).then((list) => list.items),
    staleTime: 10 * 60_000,
  });
  return { ...query, terminal: query.data ? pickTerminal(query.data, savedCode()) : null };
}
