import {
  calculateCash,
  cashQuickAmounts,
  formatSatang,
  formatTHB,
  parseThb,
  type Order,
  type PaymentMethod,
} from "@pos/shared";
import {
  IconCash,
  IconCircleCheckFilled,
  IconCreditCard,
  IconQrcode,
  type TablerIcon,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { ResultBox } from "@/components/ui/ResultBox";
import { TextField } from "@/components/ui/TextField";
import { errorMessage } from "@/lib/errors";
import { isApiError } from "@/lib/http-client";
import type { CartView } from "../cart";
import { useCartStore } from "../cart-store";
import { useCheckout } from "../queries";

export interface PaymentDialogProps {
  open: boolean;
  cart: CartView;
  terminalId: string;
  /** Closed without a sale (Cancel / Esc). */
  onCancel: () => void;
  /** Sale done and the cashier moved on. `scanned` = a barcode scanned on the success screen. */
  onNewSale: (scanned?: string) => void;
}

/** Payment dialog (plan.md → Payment dialog). Cash in step 6; PromptPay and Credit in step 7. */
export function PaymentDialog(props: PaymentDialogProps) {
  // Mounted only while open: every opening gets a fresh idempotency key and form.
  return props.open ? <PaymentForm {...props} /> : null;
}

const METHODS: {
  method: PaymentMethod;
  label: string;
  icon: TablerIcon;
  shortcut: string;
  ready: boolean;
}[] = [
  { method: "CASH", label: "Cash", icon: IconCash, shortcut: "1", ready: true },
  { method: "PROMPTPAY", label: "PromptPay", icon: IconQrcode, shortcut: "2", ready: false },
  { method: "CREDIT", label: "Credit", icon: IconCreditCard, shortcut: "3", ready: false },
];

function PaymentForm({ cart, terminalId, onCancel, onNewSale }: PaymentDialogProps) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [receivedText, setReceivedText] = useState("");
  const [sale, setSale] = useState<Order | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const checkout = useCheckout();
  const clearCart = useCartStore((state) => state.clear);
  const { total } = cart.totals;

  // Empty means "paid exactly" — the fastest cash flow: F9, Enter.
  const received = receivedText.trim() === "" ? total : parseThb(receivedText);
  const cash = received === null ? null : calculateCash(total, received);
  const canPay = cash !== null && cash.short === 0 && !checkout.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canPay || received === null) return;
    checkout.mutate(
      {
        idempotencyKey,
        input: {
          terminalId,
          items: cart.rows.map((row) => ({ productId: row.productId, qty: row.qty })),
          discount:
            cart.totals.discountValue > 0
              ? { type: "FIXED", value: cart.totals.discountValue }
              : null,
          payment: { method: "CASH", cashReceived: received },
          clientCreatedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: (order) => {
          clearCart(); // the bill is saved: a reload must not show it again
          setSale(order);
        },
      },
    );
  };

  // 1 / 2 / 3 switch method, when not typing in a field.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    const option = METHODS.find((m) => m.shortcut === event.key);
    if (option?.ready) setMethod(option.method);
  };

  if (sale) return <SaleDone order={sale} onNewSale={onNewSale} />;
  const itemsLabel = itemCountLabel(cart.itemCount);

  return (
    <Dialog
      open
      size="lg"
      title={
        <span className="flex items-baseline justify-between gap-4">
          <span>Payment · {itemsLabel}</span>
          <span className="text-3xl">{formatTHB(total)}</span>
        </span>
      }
      onClose={checkout.isPending ? undefined : onCancel}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={checkout.isPending}>
            Cancel <Kbd className="ml-1">Esc</Kbd>
          </Button>
          <Button type="submit" size="lg" loading={checkout.isPending} disabled={!canPay}>
            Complete sale{" "}
            <Kbd className="ml-1 border-white/60 bg-transparent text-white">Enter</Kbd>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" onKeyDown={onKeyDown}>
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-3">
          {METHODS.map((option) => (
            <MethodCard
              key={option.method}
              {...option}
              selected={method === option.method}
              onSelect={setMethod}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            ref={amountRef}
            label="Amount received"
            unit="฿"
            inputMode="decimal"
            autoFocus
            autoComplete="off"
            placeholder={`${formatSatang(total)} (exact)`}
            value={receivedText}
            error={
              received === null
                ? "Enter an amount like 100 or 52.50"
                : cash && cash.short > 0
                  ? `Short by ${formatTHB(cash.short)}`
                  : undefined
            }
            hint="Leave it empty if the customer paid exactly."
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setReceivedText(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {cashQuickAmounts(total).map((amount, index) => (
              <Chip
                key={amount}
                selected={received === amount}
                onClick={() => {
                  setReceivedText(index === 0 ? "" : formatSatang(amount).replace(/\.00$/, ""));
                  amountRef.current?.focus(); // so Enter completes the sale next
                }}
              >
                {index === 0 ? "Exact" : formatSatang(amount).replace(/\.00$/, "")}
              </Chip>
            ))}
          </div>
        </div>

        <ResultBox label="Change">
          {cash && cash.short === 0 ? formatTHB(cash.change) : "—"}
        </ResultBox>

        {checkout.isError && <Alert tone="danger">{paymentError(checkout.error)}</Alert>}
      </div>
    </Dialog>
  );
}

function itemCountLabel(count: number) {
  return `${count.toLocaleString("en-US")} item${count === 1 ? "" : "s"}`;
}

function paymentError(error: unknown): string {
  if (isApiError(error) && error.isNetwork) {
    return "Couldn't reach the server, so the sale isn't saved yet. The cart is kept — press Complete sale to try again.";
  }
  return errorMessage(error);
}

function MethodCard({
  method,
  label,
  icon: Icon,
  shortcut,
  ready,
  selected,
  onSelect,
}: (typeof METHODS)[number] & { selected: boolean; onSelect: (method: PaymentMethod) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!ready}
      onClick={() => onSelect(method)}
      className={clsx(
        "relative flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-colors",
        "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
        selected
          ? "border-primary bg-primary-tint text-primary-dark"
          : "border-border-strong bg-page hover:border-primary",
        !ready && "cursor-not-allowed opacity-50 hover:border-border-strong",
      )}
    >
      <Kbd className="absolute top-2 left-2">{shortcut}</Kbd>
      <Icon size={28} aria-hidden />
      <span className="font-medium">{label}</span>
      {!ready && <span className="text-xs text-text-muted">Coming in step 7</span>}
    </button>
  );
}

// ---------- Success ----------

const AUTO_CLOSE_SECONDS = 5;
/** Keys from a barcode scanner arrive within a few ms; a person types much slower. */
const SCAN_IDLE_MS = 60;

/**
 * Success state (plan.md → Payment dialog → Success). New sale on Enter, Esc, any key, the
 * countdown, or a scan — a scanned barcode is passed on so it becomes the next sale's first item.
 */
function SaleDone({ order, onNewSale }: { order: Order; onNewSale: (scanned?: string) => void }) {
  const itemsLabel = itemCountLabel(order.items.reduce((sum, line) => sum + line.qty, 0));
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
    const onKey = (event: globalThis.KeyboardEvent) => {
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

  return (
    <Dialog
      open
      size="lg"
      title={`Payment · ${itemsLabel}`}
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
        <IconCircleCheckFilled size={64} className="text-success" aria-hidden />
        <div>
          <p className="text-2xl font-semibold">Sale completed</p>
          <p className="text-text-muted">
            Bill {order.billNo} · Cash · {formatTHB(order.total)}
          </p>
        </div>
        <div className="w-full">
          <ResultBox label="Give change">{formatTHB(order.changeGiven ?? 0)}</ResultBox>
          <p className="mt-2 text-sm text-text-muted">
            Received {formatTHB(order.cashReceived ?? 0)}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
