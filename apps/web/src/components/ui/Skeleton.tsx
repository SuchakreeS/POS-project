import { clsx } from "clsx";

/** Gray placeholder while data loads (plan.md → Loading). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx("block animate-pulse rounded-full bg-hover", className)} />
  );
}
