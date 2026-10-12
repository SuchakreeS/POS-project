import type { TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: TablerIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "danger";
  className?: string;
}

const ICON_TONES = {
  neutral: "bg-hover text-text-soft",
  primary: "bg-primary-tint text-primary",
  success: "bg-success-tint text-success",
  danger: "bg-danger-tint text-danger",
};

/** Icon + one bold line + one gray line + optional action (plan.md → Empty states). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span
        className={clsx("flex size-14 items-center justify-center rounded-full", ICON_TONES[tone])}
      >
        <Icon size={28} aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      {description && <p className="max-w-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
