import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

type Tone = "danger" | "warning" | "success" | "info";

const TONES: Record<Tone, { box: string; Icon: typeof IconAlertCircle }> = {
  danger: { box: "bg-danger-tint text-danger-text", Icon: IconAlertCircle },
  warning: { box: "bg-warning-tint text-warning-text", Icon: IconAlertCircle },
  success: { box: "bg-success-tint text-success-text", Icon: IconCircleCheck },
  info: { box: "bg-surface-alt text-text-soft", Icon: IconInfoCircle },
};

/** Inline notice banner (plan.md → Banners). Danger alerts are announced to screen readers. */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
        box,
        className,
      )}
    >
      <Icon size={20} className="mt-px shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
