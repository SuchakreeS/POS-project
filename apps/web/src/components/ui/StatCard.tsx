import { clsx } from "clsx";
import type { ReactNode } from "react";

const TONES = {
  warning: "bg-warning-tint text-warning-text",
  success: "bg-success-tint text-success-text",
  neutral: "bg-surface-alt text-text",
};

/** Tinted card with a label and a big value (plan.md → Stat cards). */
export function StatCard({
  tone,
  label,
  value,
  detail,
}: {
  tone: keyof typeof TONES;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className={clsx("flex flex-col rounded-2xl px-5 py-3", TONES[tone])}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {detail && <span className="text-sm opacity-80">{detail}</span>}
    </div>
  );
}
