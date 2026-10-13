import { formatTHB, type PromptPayBill } from "@pos/shared";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { useUndoReceived } from "../queries";

/** Put a bill back to Pending, with a reason (plan.md → PromptPay → Undo). */
export function UndoReceivedDialog({
  bill,
  onClose,
}: {
  bill: PromptPayBill | null;
  onClose: () => void;
}) {
  return bill ? <UndoForm key={bill.orderId} bill={bill} onClose={onClose} /> : null;
}

function UndoForm({ bill, onClose }: { bill: PromptPayBill; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const undo = useUndoReceived();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) return setError("Say why it wasn't received");
    undo.mutate(
      { orderId: bill.orderId, reason },
      {
        onSuccess: () => {
          toast.success(`Bill ${bill.billNo} is pending again`);
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      size="md"
      title="Mark as not received?"
      description={`Bill ${bill.billNo} · ${formatTHB(bill.total)} goes back to Pending.`}
      onClose={undo.isPending ? undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={undo.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={undo.isPending}>
            Move back to Pending
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Reason"
          required
          autoFocus
          maxLength={200}
          placeholder="e.g. Matched the wrong bill in the bank app"
          value={reason}
          error={error}
          onChange={(event) => {
            setReason(event.target.value);
            setError(undefined);
          }}
        />
        {undo.isError && <Alert tone="danger">{errorMessage(undo.error)}</Alert>}
      </div>
    </Dialog>
  );
}
