import type { ReactNode } from "react";

/** Gray box with a label on the left and a big value on the right: "Stock  24 → 21 pcs" (plan.md → Result boxes). */
export function ResultBox({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-border bg-surface-alt px-5 py-3">
      <span className="font-medium">{label}</span>
      <span className="text-right text-2xl font-semibold">{children}</span>
    </div>
  );
}
