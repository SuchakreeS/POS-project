import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Ask before closing a form with unsaved changes (plan.md → Confirm dialogs → Discard work).
 * Use `requestClose` for ✕ / Esc / Cancel and render `confirm` next to the form.
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
  const [asking, setAsking] = useState(false);

  const requestClose = () => (dirty ? setAsking(true) : onClose());

  const confirm = (
    <ConfirmDialog
      open={asking}
      icon={IconAlertTriangle}
      title={title}
      description={description}
      cancelLabel="Keep editing"
      confirmLabel="Discard"
      destructive
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        onClose();
      }}
    />
  );

  return { requestClose, confirm };
}
