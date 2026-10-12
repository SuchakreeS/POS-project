import { IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ComponentProps } from "react";

interface SelectProps extends Omit<ComponentProps<"select">, "size"> {
  /** Accessible name when there's no visible label. */
  label: string;
  /** Highlight like a selected chip (a filter is applied). */
  active?: boolean;
}

/** Native select styled as a pill chip — keyboard and scanner friendly, nothing to break. */
export function Select({ label, active, className, children, ...props }: SelectProps) {
  return (
    <div className={clsx("relative inline-flex", className)}>
      <select
        aria-label={label}
        className={clsx(
          "h-9 w-full cursor-pointer appearance-none rounded-full border-2 pr-9 pl-4 text-sm font-medium transition-colors",
          "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
          active
            ? "border-primary bg-primary-tint text-primary-dark"
            : "border-border-strong bg-page text-text hover:bg-hover",
        )}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown
        size={18}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-soft"
      />
    </div>
  );
}
