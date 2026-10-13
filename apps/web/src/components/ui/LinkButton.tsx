import { clsx } from "clsx";
import type { ComponentProps } from "react";

/** A button that looks like a text link (row "Restock", "Restock · Adjust" next to a field). */
export function LinkButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={clsx(
        "rounded font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
