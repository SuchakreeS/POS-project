import {
  formatSatang,
  formatTHB,
  NOTE_MAX,
  PAYMENT_METHOD_LABELS,
  VOID_REASONS,
  type Order,
  type VoidReason,
} from "@pos/shared";
import { IconArrowLeft, IconReceiptOff } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useMarkReceived } from "@/features/promptpay/queries";
import { formatDayTime, formatTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, focusFirstInvalid } from "@/lib/forms";
import { isApiError } from "@/lib/http-client";
import { voidEffect } from "../orders-view";
import { useOrder, useVoidOrder } from "../queries";

/** Bill detail (plan.md → Bill detail dialog): items, totals, payment, and Void with a reason. */
export function BillDetailDialog({
  orderId,
  onClose,
}: {
  /** The bill; null = closed. */
  orderId: string | null;
  onClose: () => void;
}) {
  const bill = useOrder(orderId);
  if (!orderId) return null;

  if (!bill.data) {
    return (
      <Dialog open title="Bill" onClose={onClose}>
        {bill.isError ? (
          <Alert tone="danger">{errorMessage(bill.error)}</Alert>
        ) : (
          <div className="flex flex-col gap-3" aria-busy>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-8 w-full" />
            ))}
          </div>
        )}
      </Dialog>
    );
  }
  return <BillBody order={bill.data} onClose={onClose} />;
}

function BillBody({ order, onClose }: { order: Order; onClose: () => void }) {
  const [voiding, setVoiding] = useState(false);
  const voided = order.status === "VOIDED";

  if (voiding && !voided) {
    return <VoidStep order={order} onBack={() => setVoiding(false)} onClose={onClose} />;
  }

  return (
    <Dialog
      open
      title={
        <span className="flex items-center gap-3">
          Bill {order.billNo}
          {voided ? <Badge tone="danger">Voided</Badge> : <Badge tone="success">Completed</Badge>}
        </span>
      }
      description={`${formatDayTime(order.createdAt)} · Cashier ${order.cashierName} · Terminal ${order.terminalCode}`}
      onClose={onClose}
      footer={
        <>
          {!voided && (
            <Button
              variant="danger"
              className="mr-auto -ml-3"
              icon={<IconReceiptOff size={18} aria-hidden />}
              onClick={() => setVoiding(true)}
            >
              Void bill
            </Button>
          )}
          {/* Focus starts on Close, never on Void bill. */}
          <Button variant="secondary" autoFocus onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {order.voided && (
          <Alert tone="danger">
            <span className="block font-medium">
              Voided {formatDayTime(order.voided.at)} by {order.voided.by} · {order.voided.reason}
            </span>
            {order.voided.note && <span className="block">{order.voided.note}</span>}
          </Alert>
        )}
        <Lines order={order} />
        <Payment order={order} onLeave={onClose} />
      </div>
    </Dialog>
  );
}

function Lines({ order }: { order: Order }) {
  return (
    <div>
      <ul className="flex flex-col">
        {order.items.map((line) => (
          <li
            key={line.productId}
            className="flex items-start justify-between gap-4 border-b-2 border-border py-2"
          >
            <span className="min-w-0">
              <span className="block font-medium">{line.productName}</span>
              <span className="block text-sm text-text-muted">
                {line.qty.toLocaleString("en-US")} × {formatSatang(line.unitPrice)}
              </span>
            </span>
            <span className="shrink-0 font-medium">{formatSatang(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-col gap-1">
        <div className="flex justify-between text-text-soft">
          <dt>Subtotal</dt>
          <dd>{formatSatang(order.subtotal)}</dd>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-text-soft">
            <dt>Discount</dt>
            <dd>−{formatSatang(order.discountAmount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-1">
          <dt className="text-lg font-semibold">Total</dt>
          <dd
            className={clsx("text-2xl font-semibold", order.status === "VOIDED" && "line-through")}
          >
            {formatTHB(order.total)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** How it was paid: cash received + change, PromptPay status, or the credit customer. */
function Payment({ order, onLeave }: { order: Order; onLeave: () => void }) {
  const navigate = useNavigate();
  const markReceived = useMarkReceived();
  const open = order.status === "COMPLETED";

  return (
    <section
      aria-label="Payment"
      className="flex flex-col gap-1 rounded-2xl bg-surface-alt px-5 py-4"
    >
      <span className="text-sm text-text-muted">Paid with</span>
      {order.paymentMethod === "CASH" && (
        <>
          <span className="font-semibold">Cash</span>
          <span className="text-text-soft">
            Received {formatTHB(order.cashReceived ?? 0)} · Change{" "}
            {formatTHB(order.changeGiven ?? 0)}
          </span>
        </>
      )}

      {order.paymentMethod === "PROMPTPAY" && order.promptpay && (
        <span className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">PromptPay</span>
          {order.promptpay.status === "RECEIVED" ? (
            <Badge tone="success">
              Received {order.promptpay.receivedAt ? formatTime(order.promptpay.receivedAt) : ""}
              {order.promptpay.receivedBy ? ` · ${order.promptpay.receivedBy}` : ""}
            </Badge>
          ) : (
            <>
              <Badge tone="warning">Pending</Badge>
              {open && (
                <LinkButton
                  disabled={markReceived.isPending}
                  onClick={() =>
                    markReceived.mutate([order.id], {
                      onSuccess: () => toast.success(`Bill ${order.billNo} marked received`),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  Mark received
                </LinkButton>
              )}
            </>
          )}
        </span>
      )}

      {order.paymentMethod === "CREDIT" && (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Credit ·</span>
          {order.customer ? (
            <LinkButton
              onClick={() => {
                onLeave();
                void navigate(`/credit?customer=${order.customer?.id}`);
              }}
            >
              {order.customer.name}
            </LinkButton>
          ) : (
            <span className="text-text-muted">Unknown customer</span>
          )}
        </span>
      )}
    </section>
  );
}

// ---------- Void step ----------

const VOID_FIELDS = ["reason", "note"] as const;
type VoidField = (typeof VOID_FIELDS)[number];

function VoidStep({
  order,
  onBack,
  onClose,
}: {
  order: Order;
  onBack: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<VoidReason | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<VoidField, string>>>({});
  const voidOrder = useVoidOrder(order.id);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const found: typeof errors = {};
    if (!reason) found.reason = "Pick a reason";
    if (reason === "Other" && !note.trim()) found.note = "Say what happened";
    setErrors(found);
    if (Object.keys(found).length > 0 || !reason) return focusFirstInvalid(form);

    voidOrder.mutate(
      { reason, note },
      {
        // The bill dialog shows the voided bill afterwards, as confirmation.
        onSuccess: (voided) => toast.success(`Bill ${voided.billNo} voided`),
        onError: (failure) => {
          const fieldErrors = apiFieldErrors(failure, VOID_FIELDS);
          if (fieldErrors) {
            setErrors(fieldErrors);
            return focusFirstInvalid(form);
          }
          toast.error(errorMessage(failure)); // e.g. someone else voided it a moment ago
          if (isApiError(failure) && failure.status === 409) onBack();
        },
      },
    );
  };

  return (
    <Dialog
      open
      title={`Void bill ${order.billNo}`}
      description={`${formatTHB(order.total)} · ${PAYMENT_METHOD_LABELS[order.paymentMethod]} · ${formatDayTime(order.createdAt)}`}
      onClose={voidOrder.isPending ? undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto -ml-3"
            icon={<IconArrowLeft size={18} aria-hidden />}
            disabled={voidOrder.isPending}
            onClick={onBack}
          >
            Back
          </Button>
          <Button type="submit" variant="dangerSolid" loading={voidOrder.isPending}>
            Void bill
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert tone="danger">{voidEffect(order)}</Alert>

        <fieldset aria-invalid={errors.reason ? true : undefined} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            Reason <span className="text-danger">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {VOID_REASONS.map((option) => (
              <Chip
                key={option}
                selected={reason === option}
                onClick={() => {
                  setReason(option);
                  setErrors((current) => ({ ...current, reason: undefined }));
                }}
              >
                {option}
              </Chip>
            ))}
          </div>
          {errors.reason && <p className="text-sm text-danger">{errors.reason}</p>}
        </fieldset>

        <TextField
          label={reason === "Other" ? "Note" : "Note (optional)"}
          required={reason === "Other"}
          maxLength={NOTE_MAX}
          placeholder="What happened?"
          value={note}
          error={errors.note}
          onChange={(event) => {
            setNote(event.target.value);
            setErrors((current) => ({ ...current, note: undefined }));
          }}
        />
      </div>
    </Dialog>
  );
}
