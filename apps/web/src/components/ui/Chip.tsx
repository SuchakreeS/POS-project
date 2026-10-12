import { clsx } from "clsx";
import type { ComponentProps } from "react";

interface ChipProps extends ComponentProps<"button"> {
  selected?: boolean;
  count?: number;
}

/** Filter chip with an optional count: "Low (6)" (plan.md → Choice controls). */
export function Chip({ selected, count, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        "inline-flex h-9 items-center gap-1 rounded-full border-2 px-4 text-sm font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
        selected
          ? "border-primary bg-primary-tint text-primary-dark"
          : "border-border-strong bg-page text-text hover:bg-hover",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={clsx(!selected && "text-text-muted")}>({count})</span>
      )}
    </button>
  );
}
