import { IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Called on ✕, Esc or a click on the overlay. Leave it out for dialogs that must not be dismissed. */
  onClose?: () => void;
  /** Wraps body and footer in a <form>, so Enter submits and footer buttons can be type="submit". */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

const SIZES = { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-3xl" };

/**
 * Modal built on the native <dialog> element, which gives focus trapping,
 * Esc handling and the top layer for free (plan.md → Dialogs).
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

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
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault(); // `open` decides when it closes
        onClose?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.(); // click on the overlay
      }}
      className={clsx(
        "m-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-hidden rounded-[20px] bg-page p-0 text-text",
        "backdrop:bg-overlay open:flex open:flex-col",
        SIZES[size],
      )}
    >
      <header className="flex items-start gap-4 border-b-2 border-border px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="mt-1 text-text-muted">
              {description}
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <IconX size={24} aria-hidden />
          </button>
        )}
      </header>

      {onSubmit ? (
        <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          {bodyAndFooter}
        </form>
      ) : (
        bodyAndFooter
      )}
    </dialog>
  );
}
