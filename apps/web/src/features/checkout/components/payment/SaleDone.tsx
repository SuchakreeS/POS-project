import { formatTHB, type CheckoutResponse, type PaymentMethod } from "@pos/shared";
import { IconCircleCheckFilled, IconClockHour4 } from "@tabler/icons-react";
import { useEffect, useEffectEvent, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { ResultBox } from "@/components/ui/ResultBox";

const AUTO_CLOSE_SECONDS = 5;
/** Keys from a barcode scanner arrive within a few ms; a person types much slower. */
const SCAN_IDLE_MS = 60;

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  PROMPTPAY: "PromptPay",
  CREDIT: "Credit",
};

/**
 * Success state (plan.md → Payment dialog → Success). New sale on Enter, Esc, any key, the
 * countdown, or a scan — a scanned barcode is passed on so it becomes the next sale's first item.
 */
export function SaleDone({
  result,
  onNewSale,
}: {
  result: CheckoutResponse;
  onNewSale: (scanned?: string) => void;
}) {
  const { order, customerBalance } = result;
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);
  const finish = useEffectEvent((scanned?: string) => onNewSale(scanned));

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (secondsLeft <= 0) finish();
  }, [secondsLeft]);

  // Catch keys before anything else: Enter / Esc / any key = new sale; fast keys + Enter = a scan.
  useEffect(() => {
    let buffer = "";
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Tab" ||
        event.key === "Shift" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(idle);
      if (event.key === "Enter" || event.key === "Escape") return finish(buffer || undefined);
      if (event.key.length === 1) buffer += event.key;
      idle = setTimeout(() => finish(), SCAN_IDLE_MS); // a single key press, not a scan
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(idle);
    };
  }, []);

  const itemCount = order.items.reduce((sum, line) => sum + line.qty, 0);
  const pending = order.paymentMethod === "PROMPTPAY";
  const customerName = order.customer?.name ?? "";

  return (
    <Dialog
      open
      size="lg"
      title={`Payment · ${itemCount.toLocaleString("en-US")} item${itemCount === 1 ? "" : "s"}`}
      onClose={() => onNewSale()}
      footer={
        <>
          <span className="mr-auto text-sm text-text-muted">
            Closes in {Math.max(secondsLeft, 0)} s
          </span>
          <Button
            size="lg"
            autoFocus
            className="ring-4 ring-primary-tint"
            onClick={() => onNewSale()}
          >
            New sale <Kbd className="ml-1 border-white/60 bg-transparent text-white">Enter</Kbd>
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        {pending ? (
          <span className="flex size-16 items-center justify-center rounded-full bg-warning-tint text-warning">
            <IconClockHour4 size={40} aria-hidden />
          </span>
        ) : (
          <IconCircleCheckFilled size={64} className="text-success" aria-hidden />
        )}
        <div>
          <p className="text-2xl font-semibold">
            {pending
              ? "Saved as pending"
              : order.paymentMethod === "CREDIT"
                ? `Added to ${customerName}'s credit`
                : "Sale completed"}
          </p>
          <p className="text-text-muted">
            Bill {order.billNo} · {METHOD_LABELS[order.paymentMethod]} · {formatTHB(order.total)}
          </p>
        </div>

        <div className="w-full text-left">
          {order.paymentMethod === "CASH" && (
            <>
              <ResultBox label="Give change">{formatTHB(order.changeGiven ?? 0)}</ResultBox>
              <p className="mt-2 text-center text-sm text-text-muted">
                Received {formatTHB(order.cashReceived ?? 0)}
              </p>
            </>
          )}
          {pending && (
            <Alert tone="warning">
              Check the bank app later and mark it received on the PromptPay page.
            </Alert>
          )}
          {order.paymentMethod === "CREDIT" && customerBalance !== null && (
            <ResultBox label={`${customerName} now owes`}>{formatTHB(customerBalance)}</ResultBox>
          )}
        </div>
      </div>
    </Dialog>
  );
}
