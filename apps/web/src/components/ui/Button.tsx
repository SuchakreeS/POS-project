import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the button's width, and blocks clicks. */
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

// Every variant has a 2px border (transparent when not visible) so all buttons are the same height
// and nothing shifts between states (plan.md → Shape and style).
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-white hover:bg-primary-dark disabled:bg-border-strong",
  secondary:
    "border-primary bg-page text-primary hover:bg-primary-tint disabled:border-border disabled:text-text-muted disabled:hover:bg-page",
  outline:
    "border-border-strong bg-page text-text hover:bg-hover disabled:text-text-muted disabled:hover:bg-page",
  ghost: "border-transparent text-text-soft hover:bg-hover disabled:text-text-muted",
  danger: "border-transparent text-danger hover:bg-danger-tint disabled:text-text-muted",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-base",
  lg: "h-12 px-8 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-2 font-medium whitespace-nowrap transition-colors",
        "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      <span className={clsx("inline-flex items-center gap-2", loading && "invisible")}>
        {icon}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
}
