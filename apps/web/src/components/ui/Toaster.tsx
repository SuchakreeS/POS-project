import { IconAlertCircle, IconCircleCheckFilled, IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useEffect } from "react";
import { useToastStore } from "./toast";

const SUCCESS_MS = 4000;

/** Bottom left, away from the cart and the right sidebar. Success hides by itself; errors stay until closed. */
export function Toaster() {
  const toast = useToastStore((state) => state.toast);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (toast?.tone !== "success") return;
    const timer = setTimeout(() => dismiss(toast.id), SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-6 z-[60]">
      {toast && (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={clsx(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-full border-2 py-2 pr-2 pl-4 font-medium shadow-lg",
            toast.tone === "success"
              ? "border-transparent bg-text text-white"
              : "border-danger bg-page text-danger",
          )}
        >
          {toast.tone === "success" ? (
            <IconCircleCheckFilled size={20} className="shrink-0 text-success" aria-hidden />
          ) : (
            <IconAlertCircle size={20} className="shrink-0" aria-hidden />
          )}
          <span className="min-w-0">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                dismiss(toast.id);
              }}
              className="rounded-full px-2 font-semibold underline-offset-2 hover:underline"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={() => dismiss(toast.id)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
          >
            <IconX size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
