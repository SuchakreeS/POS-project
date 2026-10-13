import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Keyboard hint badge shown on buttons: Esc, Enter, F9 (plan.md → Buttons). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border-2 border-placeholder bg-page px-1.5 font-sans text-xs font-medium text-text-soft",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
