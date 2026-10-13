import {
  formatTHB,
  type CheckoutResponse,
  type PaymentInput,
  type PaymentMethod,
} from "@pos/shared";
import { IconCash, IconCreditCard, IconQrcode, type TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import type { CustomerChoice } from "@/features/credit/customer-choice";
import { errorMessage } from "@/lib/errors";
import { isApiError } from "@/lib/http-client";
import type { CartView } from "../cart";
import { useCartStore } from "../cart-store";
import { useCheckout } from "../queries";
import { readCash } from "./payment/cash";
import { CashPanel } from "./payment/CashPanel";
import { CreditPanel } from "./payment/CreditPanel";
import { PromptPayPanel } from "./payment/PromptPayPanel";
import { SaleDone } from "./payment/SaleDone";

export interface PaymentDialogProps {
  open: boolean;
  cart: CartView;
  terminalId: string;
  /** Closed without a sale (Cancel / Esc). */
  onCancel: () => void;
  /** Sale done and the cashier moved on. `scanned` = a barcode scanned on the success screen. */
  onNewSale: (scanned?: string) => void;
}

/** Payment dialog (plan.md → Payment dialog): Cash, PromptPay or Credit, then the success state. */
export function PaymentDialog(props: PaymentDialogProps) {
  // Mounted only while open: every opening gets a fresh idempotency key and form.
  return props.open ? <PaymentForm {...props} /> : null;
}

const METHODS: {
  method: PaymentMethod;
  label: string;
  icon: TablerIcon;
  shortcut: string;
  confirm: string;
}[] = [
  { method: "CASH", label: "Cash", icon: IconCash, shortcut: "1", confirm: "Complete sale" },
  {
    method: "PROMPTPAY",
    label: "PromptPay",
    icon: IconQrcode,
    shortcut: "2",
    confirm: "Save as pending",
  },
  {
    method: "CREDIT",
    label: "Credit",
    icon: IconCreditCard,
    shortcut: "3",
    confirm: "Add to credit",
  },
];

function PaymentForm({ cart, terminalId, onCancel, onNewSale }: PaymentDialogProps) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [cashText, setCashText] = useState("");
  const [customer, setCustomer] = useState<CustomerChoice | null>(null);
  const [customerError, setCustomerError] = useState<string>();
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const checkout = useCheckout();
  const clearCart = useCartStore((state) => state.clear);
  const { total } = cart.totals;

  /** The payment to send, or null while something is missing. */
  const payment = ((): PaymentInput | null => {
    if (method === "PROMPTPAY") return { method };
    if (method === "CREDIT") {
      if (!customer) return null;
      return {
        method,
        customer:
          customer.kind === "existing" ? { id: customer.customer.id } : { newName: customer.name },
      };
    }
    const cash = readCash(total, cashText);
    return cash.ready && cash.received !== null ? { method, cashReceived: cash.received } : null;
  })();
  const creditBlocked = method === "CREDIT" && total === 0;

  const switchMethod = (next: PaymentMethod) => {
    setMethod(next);
    checkout.reset();
    // PromptPay has nothing to type: put focus on the confirm button so Enter saves it.
    if (next === "PROMPTPAY") requestAnimationFrame(() => confirmRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (method === "CREDIT" && !customer)
      return setCustomerError("Pick a customer or type a new name");
    if (!payment || creditBlocked || checkout.isPending) return;
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
          payment,
          clientCreatedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: (response) => {
          clearCart(); // the bill is saved: a reload must not show it again
          setResult(response);
        },
      },
    );
  };

  // 1 / 2 / 3 switch method, when not typing in a field (digits type the cash amount there).
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    const option = METHODS.find((m) => m.shortcut === event.key);
    if (option) {
      event.preventDefault();
      switchMethod(option.method);
    }
  };

  if (result) return <SaleDone result={result} onNewSale={onNewSale} />;

  const current = METHODS.find((m) => m.method === method) ?? METHODS[0];
  const itemCount = cart.itemCount;

  return (
    <Dialog
      open
      size="lg"
      title={
        <span className="flex items-baseline justify-between gap-4">
          <span>
            Payment · {itemCount.toLocaleString("en-US")} item{itemCount === 1 ? "" : "s"}
          </span>
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
          <Button
            ref={confirmRef}
            type="submit"
            size="lg"
            loading={checkout.isPending}
            disabled={(method !== "CREDIT" && !payment) || creditBlocked}
          >
            {current?.confirm}{" "}
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
              onSelect={switchMethod}
            />
          ))}
        </div>

        {method === "CASH" && <CashPanel total={total} text={cashText} onChange={setCashText} />}
        {method === "PROMPTPAY" && <PromptPayPanel total={total} />}
        {method === "CREDIT" &&
          (creditBlocked ? (
            <Alert tone="warning">
              The total is 0.00, so there's nothing to put on credit. Use Cash instead.
            </Alert>
          ) : (
            <CreditPanel
              total={total}
              customer={customer}
              error={customerError}
              onChange={(choice) => {
                setCustomer(choice);
                setCustomerError(undefined);
                if (choice) requestAnimationFrame(() => confirmRef.current?.focus());
              }}
            />
          ))}

        {checkout.isError && <Alert tone="danger">{paymentError(checkout.error)}</Alert>}
      </div>
    </Dialog>
  );
}

function paymentError(error: unknown): string {
  if (isApiError(error) && error.isNetwork) {
    return "Couldn't reach the server, so the sale isn't saved yet. The cart is kept — press the button again to try.";
  }
  return errorMessage(error);
}

function MethodCard({
  method,
  label,
  icon: Icon,
  shortcut,
  selected,
  onSelect,
}: (typeof METHODS)[number] & { selected: boolean; onSelect: (method: PaymentMethod) => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(method)}
      className={clsx(
        "relative flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 transition-colors",
        "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
        selected
          ? "border-primary bg-primary-tint text-primary-dark"
          : "border-border-strong bg-page hover:border-primary",
      )}
    >
      <Kbd className="absolute top-2 left-2">{shortcut}</Kbd>
      <Icon size={28} aria-hidden />
      <span className="font-medium">{label}</span>
    </button>
  );
}
