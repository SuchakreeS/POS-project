import {
  bangkokDateKey,
  formatSatang,
  formatTHB,
  parseThb,
  type CreditHistoryEntry,
  type CustomerDetail,
  type RepaymentMethod,
} from "@pos/shared";
import { IconArrowLeft, IconCash, IconPencil, IconPhone, IconQrcode } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { ResultBox } from "@/components/ui/ResultBox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { formatDayLabel, formatTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { isApiError } from "@/lib/http-client";
import { useCustomerDetail, useRecordRepayment } from "../queries";
import { CustomerFormDialog } from "./CustomerFormDialog";

export type CustomerDialogStep = "history" | "payment";

export interface CustomerCreditDialogProps {
  /** The customer; null = closed. */
  customerId: string | null;
  /** Open straight on "Record payment" (the table's button). */
  initialStep?: CustomerDialogStep;
  onClose: () => void;
}

const sinceFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
});

/** Customer credit dialog (plan.md → Customer credit dialog): history, then Record payment. */
export function CustomerCreditDialog({
  customerId,
  initialStep = "history",
  onClose,
}: CustomerCreditDialogProps) {
  const detail = useCustomerDetail(customerId);
  if (!customerId) return null;

  if (!detail.data) {
    return (
      <Dialog open size="lg" title="Customer" onClose={onClose}>
        {detail.isError ? (
          <Alert tone="danger">{errorMessage(detail.error)}</Alert>
        ) : (
          <div className="flex flex-col gap-3" aria-busy>
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-8 w-full" />
            ))}
          </div>
        )}
      </Dialog>
    );
  }
  return (
    <CustomerDialogBody
      key={customerId}
      customer={detail.data}
      initialStep={initialStep}
      onClose={onClose}
    />
  );
}

function CustomerDialogBody({
  customer,
  initialStep,
  onClose,
}: {
  customer: CustomerDetail;
  initialStep: CustomerDialogStep;
  onClose: () => void;
}) {
  const [step, setStep] = useState<CustomerDialogStep>(
    customer.balance > 0 ? initialStep : "history",
  );
  const [editing, setEditing] = useState(false);

  const subtitle = customer.firstChargeAt
    ? `On credit since ${sinceFormat.format(new Date(customer.firstChargeAt))} · ${customer.creditBillCount} credit bill${customer.creditBillCount === 1 ? "" : "s"}`
    : "No credit bills yet";

  return (
    <>
      {step === "payment" ? (
        <RecordPayment
          customer={customer}
          onBack={() => setStep("history")}
          onDone={onClose}
          onClose={onClose}
        />
      ) : (
        <Dialog
          open
          size="lg"
          title={
            <span className="flex items-center gap-3">
              {customer.name}
              <button
                type="button"
                aria-label={`Edit ${customer.name}`}
                onClick={() => setEditing(true)}
                className="flex size-8 items-center justify-center rounded-full text-text-soft hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <IconPencil size={18} aria-hidden />
              </button>
            </span>
          }
          description={subtitle}
          onClose={onClose}
          footer={
            <>
              {customer.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="mr-auto flex items-center gap-1.5 text-text-soft hover:text-primary"
                >
                  <IconPhone size={18} aria-hidden />
                  {customer.phone}
                </a>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button disabled={customer.balance <= 0} onClick={() => setStep("payment")}>
                Record payment
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            <div
              className={clsx(
                "flex items-center justify-between rounded-2xl px-5 py-3",
                customer.balance > 0
                  ? "bg-warning-tint text-warning-text"
                  : "bg-surface-alt text-text-soft",
              )}
            >
              <span className="font-medium">
                {customer.balance < 0 ? "Shop owes them" : "Owes now"}
              </span>
              <span className="text-3xl font-semibold">
                {formatTHB(Math.abs(customer.balance))}
              </span>
            </div>
            {customer.note && <p className="text-text-muted">Note: {customer.note}</p>}
            <HistoryTable history={customer.history} />
          </div>
        </Dialog>
      )}

      <CustomerFormDialog
        open={editing}
        customer={customer}
        initial={{ name: customer.name, phone: customer.phone ?? "", note: customer.note ?? "" }}
        onClose={() => setEditing(false)}
      />
    </>
  );
}

function HistoryTable({ history }: { history: CreditHistoryEntry[] }) {
  if (history.length === 0)
    return <p className="py-6 text-center text-text-muted">Nothing on credit yet.</p>;
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-40" />
        <col />
        <col className="w-28" />
        <col className="w-28" />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-border text-left text-sm text-text-muted">
          <th scope="col" className="px-2 py-2 font-medium">
            Date
          </th>
          <th scope="col" className="px-2 py-2 font-medium">
            What
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Amount
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            Balance
          </th>
        </tr>
      </thead>
      <tbody>
        {history.map((entry) => (
          <tr key={entry.id} className="border-b-2 border-border">
            <td className="px-2 py-2 text-sm text-text-muted">
              {formatDayLabel(bangkokDateKey(new Date(entry.createdAt)))} ·{" "}
              {formatTime(entry.createdAt)}
            </td>
            <td className="px-2 py-2">
              <What entry={entry} />
            </td>
            <td
              className={clsx(
                "px-2 text-right font-semibold",
                entry.amount < 0 && "text-success-text",
              )}
            >
              {entry.amount > 0 ? "+" : "−"}
              {formatSatang(Math.abs(entry.amount))}
            </td>
            <td className="px-2 text-right">{formatSatang(entry.balanceAfter)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** What happened (first line) and which bill or note (second line, muted). */
function What({ entry }: { entry: CreditHistoryEntry }) {
  const detail = entry.order ? `Bill ${entry.order.billNo}` : entry.note;
  const method = entry.method === "PROMPTPAY" ? "PromptPay" : "Cash";
  return (
    <>
      {entry.type === "CHARGE" && <span className="block">Credit sale</span>}
      {entry.type === "CHARGE_VOID" && <Badge tone="neutral">Voided sale</Badge>}
      {entry.type === "REPAYMENT" && <Badge tone="success">Payment · {method}</Badge>}
      {detail && <span className="block truncate text-sm text-text-muted">{detail}</span>}
    </>
  );
}

// ---------- Record payment ----------

const QUICK_AMOUNTS = [10000, 20000, 30000, 50000]; // 100 / 200 / 300 / 500 ฿

const METHODS = [
  { value: "CASH" as const, label: "Cash", icon: IconCash },
  { value: "PROMPTPAY" as const, label: "PromptPay", icon: IconQrcode },
];

function RecordPayment({
  customer,
  onBack,
  onDone,
  onClose,
}: {
  customer: CustomerDetail;
  onBack: () => void;
  onDone: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [method, setMethod] = useState<RepaymentMethod | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; method?: string }>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const record = useRecordRepayment();

  const amount = text.trim() === "" ? null : parseThb(text);
  const tooMuch = amount !== null && amount > customer.balance;
  const chipLabel = (satang: number) => formatSatang(satang).replace(/\.00$/, "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (amount === null || amount <= 0) found.amount = "Enter the amount paid";
    else if (tooMuch)
      found.amount = `Can't be more than what they owe (${formatTHB(customer.balance)})`;
    if (!method) found.method = "Pick how they paid";
    setErrors(found);
    if (found.amount) return amountRef.current?.focus();
    if (found.method || amount === null || !method) return;

    record.mutate(
      { customerId: customer.id, amount, method },
      {
        onSuccess: (result) => {
          toast.success(
            result.balanceAfter === 0
              ? `${customer.name} has paid everything`
              : `Recorded ${formatTHB(amount)} from ${customer.name}`,
          );
          onDone();
        },
      },
    );
  };

  const serverError =
    record.isError && !(isApiError(record.error) && record.error.issues?.length)
      ? errorMessage(record.error)
      : null;
  const serverAmountError = isApiError(record.error)
    ? record.error.issues?.[0]?.message
    : undefined;

  return (
    <Dialog
      open
      size="lg"
      title={`Record payment · ${customer.name}`}
      description={`Owes ${formatTHB(customer.balance)}`}
      onClose={record.isPending ? undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto -ml-3"
            icon={<IconArrowLeft size={18} aria-hidden />}
            onClick={onBack}
          >
            Back
          </Button>
          <Button type="submit" loading={record.isPending}>
            {amount !== null && amount > 0 && !tooMuch
              ? `Record ${formatTHB(amount)} payment`
              : "Record payment"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <TextField
            ref={amountRef}
            label="Amount paid"
            required
            autoFocus
            unit="฿"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            error={
              errors.amount ??
              (tooMuch
                ? `Can't be more than what they owe (${formatTHB(customer.balance)})`
                : serverAmountError)
            }
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setText(event.target.value);
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Chip
              selected={amount === customer.balance}
              onClick={() => {
                setText(formatSatang(customer.balance).replace(/,/g, ""));
                amountRef.current?.focus();
              }}
            >
              Full {formatSatang(customer.balance)}
            </Chip>
            {QUICK_AMOUNTS.filter((quick) => quick < customer.balance).map((quick) => (
              <Chip
                key={quick}
                selected={amount === quick}
                onClick={() => {
                  setText(chipLabel(quick));
                  amountRef.current?.focus();
                }}
              >
                {chipLabel(quick)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            Paid with <span className="text-danger">*</span>
          </span>
          <SegmentedControl
            label="Paid with"
            value={method ?? ("" as RepaymentMethod)}
            options={METHODS}
            onChange={(value) => {
              setMethod(value);
              setErrors((current) => ({ ...current, method: undefined }));
            }}
          />
          {errors.method && <p className="text-sm text-danger">{errors.method}</p>}
        </div>

        {amount !== null && amount > 0 && !tooMuch && (
          <ResultBox label={`${customer.name} will owe`}>
            <span className="font-normal text-text-muted">{formatSatang(customer.balance)} → </span>
            {formatTHB(customer.balance - amount)}
          </ResultBox>
        )}
        <p className="text-sm text-text-muted">
          Can't be more than what they owe. Counts as money received today, not as a new sale.
          {method === "PROMPTPAY" && " Check the bank app before recording a PromptPay payment."}
        </p>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
      </div>
    </Dialog>
  );
}
