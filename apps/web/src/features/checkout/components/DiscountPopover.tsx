import { formatSatang, formatTHB, parseThb, satangToInput } from "@pos/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { Popover } from "radix-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { TextField } from "@/components/ui/TextField";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000]; // 5 / 10 / 20 / 50 ฿

interface DiscountPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtotal: number;
  discount: number | null;
  onApply: (discount: number | null) => void;
  /** The cart's discount line, which the popover is anchored to. */
  children: ReactNode;
}

/** Fixed THB discount on the whole bill (plan.md → Discount input). `F4` opens it. */
export function DiscountPopover({
  open,
  onOpenChange,
  subtotal,
  discount,
  onApply,
  children,
}: DiscountPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor asChild>
        <div>{children}</div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Discount"
          className="z-50 w-80 rounded-2xl border-2 border-border bg-page p-5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          <DiscountForm
            subtotal={subtotal}
            discount={discount}
            onCancel={() => onOpenChange(false)}
            onApply={(value) => {
              onApply(value);
              onOpenChange(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DiscountForm({
  subtotal,
  discount,
  onApply,
  onCancel,
}: {
  subtotal: number;
  discount: number | null;
  onApply: (discount: number | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(discount ? satangToInput(discount) : "");
  const [error, setError] = useState<string>();
  const value = text.trim() === "" ? 0 : parseThb(text);
  const applied = value === null ? null : Math.min(value, subtotal);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value === null) return setError("Enter an amount like 10 or 12.50");
    onApply(value > 0 ? value : null);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Discount</h2>
      <TextField
        label="Amount off the bill"
        unit="฿"
        inputMode="decimal"
        autoFocus
        autoComplete="off"
        value={text}
        error={error}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
      />
      <div className="flex gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <Chip
            key={amount}
            selected={value === amount}
            onClick={() => setText(satangToInput(amount))}
          >
            {formatSatang(amount).replace(".00", "")}
          </Chip>
        ))}
      </div>
      {applied !== null && applied > 0 && (
        <p className="rounded-2xl bg-surface-alt px-4 py-2 text-right">
          Total <span className="text-text-muted">{formatSatang(subtotal)} →</span>{" "}
          <span className="font-semibold">{formatTHB(subtotal - applied)}</span>
        </p>
      )}
      {value !== null && value > subtotal && (
        <p className="flex items-start gap-1.5 text-sm text-text-muted">
          <IconInfoCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
          More than the bill, so it's capped and the total is 0.00.
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {discount !== null && (
          <Button
            variant="danger"
            size="sm"
            className="mr-auto -ml-3"
            onClick={() => onApply(null)}
          >
            Remove
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}
