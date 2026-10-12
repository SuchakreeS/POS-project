import { IconAlertCircle, IconEye, IconEyeOff } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

export interface TextFieldProps extends Omit<ComponentProps<"input">, "size"> {
  label: string;
  /** Shown under the field in red; also marks the input invalid for screen readers. */
  error?: string;
  hint?: string;
  /** Unit or button inside the pill on the right (฿, pcs, eye toggle). */
  endAdornment?: ReactNode;
}

/** Pill input with the label above it (plan.md → Inputs). */
export function TextField({
  label,
  error,
  hint,
  endAdornment,
  required,
  id,
  className,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={clsx(
            "h-10 w-full rounded-full border-2 bg-surface-alt px-4 text-base text-text transition-colors",
            "placeholder:text-placeholder focus:bg-page focus:ring-1 focus:outline-none",
            error
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-border focus:border-primary focus:ring-primary",
            endAdornment && "pr-12",
          )}
          {...inputProps}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-1.5 flex items-center text-text-muted">
            {endAdornment}
          </div>
        )}
      </div>

      {message && (
        <p
          id={messageId}
          className={clsx(
            "flex items-center gap-1.5 text-sm",
            error ? "text-danger" : "text-text-muted",
          )}
        >
          {error && <IconAlertCircle size={16} aria-hidden />}
          {message}
        </p>
      )}
    </div>
  );
}

/** TextField for passwords, with a show/hide eye button. */
export function PasswordField(props: Omit<TextFieldProps, "type" | "endAdornment">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? IconEyeOff : IconEye;

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex size-8 items-center justify-center rounded-full text-text-soft hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <Icon size={20} aria-hidden />
        </button>
      }
    />
  );
}
