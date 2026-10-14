import type { Terminal } from "@pos/shared";

export type ThisTerminal =
  | { status: "ready"; terminal: Terminal }
  /** The shop has no active terminal at all. */
  | { status: "none" }
  /** Several terminals and this PC hasn't been given one yet. */
  | { status: "unpicked" };

/**
 * The terminal this PC uses: the one picked on the Settings page; or, while the shop has only
 * one, that one (nothing to choose). A picked terminal that was removed counts as not picked.
 */
export function thisTerminal(
  terminals: readonly Terminal[],
  pickedId: string | null,
): ThisTerminal {
  const picked = terminals.find((terminal) => terminal.id === pickedId);
  if (picked) return { status: "ready", terminal: picked };
  const [only, ...others] = terminals;
  if (!only) return { status: "none" };
  if (others.length === 0) return { status: "ready", terminal: only };
  return { status: "unpicked" };
}
