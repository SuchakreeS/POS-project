import { IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { Dialog as RadixDialog } from "radix-ui";
import type { FormEvent, ReactNode } from "react";

export type DialogSize = "sm" | "md" | "lg" | "xl";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** sm: confirms · md: Adjust stock, Restock · lg: Payment · xl: Add / Edit item (plan.md → Dialogs). */
  size?: DialogSize;
  /** Called on ✕, Esc or a click on the overlay. Leave it out for dialogs that must not be dismissed. */
  onClose?: () => void;
  /** Wraps body and footer in a <form>, so Enter submits and footer buttons can be type="submit". */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

const SIZES: Record<DialogSize, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[512px]",
  lg: "max-w-[608px]",
  xl: "max-w-[736px]",
};

/**
 * Modal dialog (Radix: focus trap, Esc, scroll lock, works with menus and popovers inside).
 * Header and footer stay put; only the body scrolls. Focus starts on the first field, or on the
 * first footer button (Cancel) when there is none, because the ✕ comes last in the tab order.
 */
export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  size = "md",
  onClose,
  onSubmit,
}: DialogProps) {
  const dismissible = Boolean(onClose);
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  const bodyAndFooter = (
    <>
      {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>}
      {footer && (
        <footer className="flex items-center justify-end gap-3 border-t-2 border-border bg-surface-alt px-6 py-4">
          {footer}
        </footer>
      )}
    </>
  );

  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose?.()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          onInteractOutside={block}
          {...(!description && { "aria-describedby": undefined })}
          className={clsx(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-[20px] bg-page text-text shadow-xl focus:outline-none",
            SIZES[size],
          )}
        >
          <header
            className={clsx("border-b-2 border-border px-6 pt-5 pb-4", dismissible && "pr-16")}
          >
            <RadixDialog.Title className="text-xl font-semibold">{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description asChild>
                <div className="mt-1 text-text-muted">{description}</div>
              </RadixDialog.Description>
            )}
          </header>

          {onSubmit ? (
            <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              {bodyAndFooter}
            </form>
          ) : (
            bodyAndFooter
          )}

          {dismissible && (
            <RadixDialog.Close
              aria-label="Close"
              className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <IconX size={24} aria-hidden />
            </RadixDialog.Close>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
