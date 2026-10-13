import { calculateCash, parseThb } from "@pos/shared";

/** What was typed in "Amount received". Empty means paid exactly — the fastest flow: F9, Enter. */
export function readCash(total: number, text: string) {
  const received = text.trim() === "" ? total : parseThb(text);
  const cash = received === null ? null : calculateCash(total, received);
  return { received, cash, ready: cash !== null && cash.short === 0 };
}
