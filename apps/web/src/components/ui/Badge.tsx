import { clsx } from "clsx";
import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const TONES: Record<BadgeTone, { box: string; dot: string }> = {
  success: { box: "bg-success-tint text-success-text", dot: "bg-success" },
  warning: { box: "bg-warning-tint text-warning-text", dot: "bg-warning" },
  danger: { box: "bg-danger-tint text-danger-text", dot: "bg-danger" },
  neutral: { box: "bg-hover text-text-soft", dot: "bg-text-muted" },
};

/** Status pill: colored dot + label, never color alone (plan.md → Badges). Hugs its content. */
export function Badge({
  tone,
  children,
  className,
}: {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const { box, dot } = TONES[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        box,
        className,
      )}
    >
      <span aria-hidden className={clsx("size-2 shrink-0 rounded-full", dot)} />
      {children}
    </span>
  );
}
