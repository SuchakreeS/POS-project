import type { TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  icon: TablerIcon;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions get a solid red button (plan.md → Confirm dialogs). */
  destructive?: boolean;
  /** Amber icon for "are you sure?" about a status (stock), since blue is only for actions. */
  warning?: boolean;
  loading?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small "are you sure?" dialog. Focus starts on Cancel, the safe choice; Esc cancels. */
export function ConfirmDialog({
  open,
  icon: Icon,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  warning,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      size="sm"
      title={
        <span className="flex flex-col items-start gap-3">
          <span
            className={clsx(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              destructive
                ? "bg-danger-tint text-danger"
                : warning
                  ? "bg-warning-tint text-warning"
                  : "bg-primary-tint text-primary",
            )}
          >
            <Icon size={22} aria-hidden />
          </span>
          {title}
        </span>
      }
      description={description}
      onClose={loading ? undefined : onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "dangerSolid" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error}
    </Dialog>
  );
}
