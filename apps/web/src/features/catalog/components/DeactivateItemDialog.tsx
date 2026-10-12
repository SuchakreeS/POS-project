import type { Product } from "@pos/shared";
import { IconEyeOff, IconPower } from "@tabler/icons-react";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { useSetProductActive } from "../queries";

interface DeactivateItemDialogProps {
  product: Product | null;
  onClose: () => void;
  onDone?: (product: Product) => void;
}

/** Turn an item off (hidden from checkout, history kept) or back on. Asks first. */
export function DeactivateItemDialog({ product, onClose, onDone }: DeactivateItemDialogProps) {
  const setActive = useSetProductActive();
  const turningOn = product ? !product.isActive : false;

  const confirm = () => {
    if (!product) return;
    setActive.mutate(
      { id: product.id, active: turningOn },
      {
        onSuccess: (saved) => {
          toast.success(turningOn ? `${saved.name} is back on` : `${saved.name} is turned off`);
          setActive.reset();
          onDone?.(saved);
          onClose();
        },
      },
    );
  };

  const cancel = () => {
    setActive.reset();
    onClose();
  };

  return (
    <ConfirmDialog
      open={product !== null}
      icon={turningOn ? IconPower : IconEyeOff}
      destructive={!turningOn}
      title={turningOn ? `Turn ${product?.name} back on?` : `Deactivate ${product?.name}?`}
      description={
        turningOn
          ? "It shows at checkout again."
          : "It won't show at checkout any more. Its sales and stock history stay."
      }
      confirmLabel={turningOn ? "Turn back on" : "Deactivate"}
      loading={setActive.isPending}
      error={setActive.isError && <Alert tone="danger">{errorMessage(setActive.error)}</Alert>}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
}
