import { IconCheck, IconMinus } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ComponentProps } from "react";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: string;
  /** "Some selected" state for a select-all box. */
  indeterminate?: boolean;
}

/** Native checkbox, styled (plan.md → Tables → Checkbox). The label is for screen readers. */
export function Checkbox({ label, indeterminate, checked, className, ...props }: CheckboxProps) {
  const on = checked || indeterminate;
  return (
    <span className={clsx("relative inline-flex size-6 shrink-0", className)}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        aria-checked={indeterminate ? "mixed" : checked}
        className={clsx(
          "peer size-6 cursor-pointer appearance-none rounded-lg border-2 transition-colors",
          "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
          on ? "border-primary bg-primary" : "border-placeholder bg-page hover:border-primary",
        )}
        {...props}
      />
      {on && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
        >
          {indeterminate ? <IconMinus size={16} stroke={3} /> : <IconCheck size={16} stroke={3} />}
        </span>
      )}
    </span>
  );
}
