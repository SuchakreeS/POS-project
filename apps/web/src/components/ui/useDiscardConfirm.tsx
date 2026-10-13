import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Ask before closing a form with unsaved changes (plan.md → Confirm dialogs → Discard work).
 * Use `requestClose` for ✕ / Esc / Cancel and render `confirm` next to the form.
 * `closeThen(next)` closes the same way, then runs `next` — e.g. to open another dialog in its place.
 */
export function useDiscardConfirm({
  dirty,
  onClose,
  title = "Discard changes?",
  description = "What you typed here will be lost.",
}: {
  dirty: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  // While asking: what to run after closing (a function in state must be wrapped in an object).
  const [asking, setAsking] = useState<{ then?: () => void } | null>(null);

  const closeThen = (then?: () => void) => {
    if (dirty) return setAsking({ then });
    onClose();
    then?.();
  };
  const requestClose = () => closeThen();

  const confirm = (
    <ConfirmDialog
      open={asking !== null}
      icon={IconAlertTriangle}
      title={title}
      description={description}
      cancelLabel="Keep editing"
      confirmLabel="Discard"
      destructive
      onCancel={() => setAsking(null)}
      onConfirm={() => {
        const then = asking?.then;
        setAsking(null);
        onClose();
        then?.();
      }}
    />
  );

  return { requestClose, closeThen, confirm };
}
