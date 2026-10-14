import { clsx } from "clsx";
import { initialOf } from "@/lib/initials";

/** Round initial for a person (customers, users). Decorative: the name is always shown next to it. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-dark",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
