import { clsx } from "clsx";

/** On/off toggle (plan.md → Settings: Send to LINE). A real switch for screen readers; Space toggles. */
export function Switch({
  label,
  checked,
  onChange,
  description,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={clsx("flex items-start gap-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
          "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
          checked ? "bg-primary" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "size-5 rounded-full bg-page shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-text-muted">{description}</span>}
      </span>
    </label>
  );
}
