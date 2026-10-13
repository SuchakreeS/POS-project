import { formatTHB } from "@pos/shared";
import { IconAlertCircle, IconShoppingCartOff, IconTrash, IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { LinkButton } from "@/components/ui/LinkButton";
import type { CartRow, CartView } from "../cart";
import { useCartStore } from "../cart-store";
import { DiscountPopover } from "./DiscountPopover";
import { QtyInput } from "./QtyInput";

interface CartPanelProps {
  cart: CartView;
  discountOpen: boolean;
  onDiscountOpenChange: (open: boolean) => void;
  onCheckout: () => void;
  onClear: () => void;
  /** Why checkout can't start (no terminal, …); shown above the button. */
  blocker?: ReactNode;
  /** Quantity changes go through the page, which may ask about stock first. */
  onQtyChange: (productId: string, qty: number) => void;
}

/** "Current bill" panel on the right of Checkout (plan.md → Checkout layout). Never hidden. */
export function CartPanel({
  cart,
  discountOpen,
  onDiscountOpenChange,
  onCheckout,
  onClear,
  blocker,
  onQtyChange,
}: CartPanelProps) {
  const { selectedId, discount, remove, select, setDiscount } = useCartStore();
  const { totals } = cart;

  return (
    <aside
      aria-label="Current bill"
      className="flex h-full w-[380px] shrink-0 flex-col border-l-2 border-border bg-page"
    >
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Current bill</h2>
          <p className="text-sm text-text-muted">
            {cart.itemCount.toLocaleString("en-US")} item{cart.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        {cart.rows.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            icon={<IconTrash size={16} aria-hidden />}
            onClick={onClear}
          >
            Clear
          </Button>
        )}
      </header>

      {cart.rows.length === 0 ? (
        <EmptyState
          icon={IconShoppingCartOff}
          title="Scan an item to start"
          description="or search by name, or click a product"
          className="flex-1 justify-center"
        />
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto border-y-2 border-border">
          {cart.rows.map((row) => (
            <CartLineRow
              key={row.productId}
              row={row}
              selected={row.productId === selectedId}
              onSelect={() => select(row.productId)}
              onQty={(qty) => onQtyChange(row.productId, qty)}
              onRemove={() => remove(row.productId)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
        <TotalLine label="Subtotal">{formatTHB(totals.subtotal)}</TotalLine>
        <DiscountPopover
          open={discountOpen}
          onOpenChange={onDiscountOpenChange}
          subtotal={totals.subtotal}
          discount={discount}
          onApply={setDiscount}
        >
          <TotalLine label="Discount">
            {discount === null ? (
              <LinkButton
                disabled={cart.rows.length === 0}
                onClick={() => onDiscountOpenChange(true)}
                className="disabled:text-text-muted disabled:no-underline"
              >
                Add discount <Kbd className="ml-1">F4</Kbd>
              </LinkButton>
            ) : (
              <span className="flex items-center gap-3">
                <span className="font-medium">−{formatTHB(totals.discountAmount)}</span>
                <LinkButton onClick={() => onDiscountOpenChange(true)}>Edit</LinkButton>
              </span>
            )}
          </TotalLine>
        </DiscountPopover>
        <div className="mt-1 flex items-baseline justify-between border-t-2 border-border pt-3">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-[32px] leading-tight font-semibold">{formatTHB(totals.total)}</span>
        </div>

        {blocker}

        <Button
          size="lg"
          fullWidth
          className="mt-2 h-14 text-xl"
          disabled={!cart.sellable || Boolean(blocker)}
          onClick={onCheckout}
        >
          Checkout <Kbd className="ml-1 border-white/60 bg-transparent text-white">F9</Kbd>
        </Button>
      </div>
    </aside>
  );
}

function TotalLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function CartLineRow({
  row,
  selected,
  onSelect,
  onQty,
  onRemove,
}: {
  row: CartRow;
  selected: boolean;
  onSelect: () => void;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const name = row.product?.name ?? "Unknown item";

  // Keep the last scanned line in view.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected, row.qty]);

  return (
    <li
      ref={ref}
      onClick={onSelect}
      className={clsx(
        "flex items-center gap-2 border-b-2 border-border px-5 py-2 last:border-b-0",
        selected && "bg-primary-tint",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={name}>
          {name}
        </p>
        {row.problem ? (
          <p className="flex items-center gap-1 text-sm text-danger">
            <IconAlertCircle size={14} aria-hidden />
            {row.problem} — remove it
          </p>
        ) : row.product && row.qty > row.product.stockQty ? (
          // Allowed (stock may be wrong), but visible so the cashier can double-check.
          <p className="text-sm font-medium text-warning-text">
            {row.product.stockQty <= 0
              ? "Out of stock"
              : `Only ${row.product.stockQty.toLocaleString("en-US")} in stock`}
          </p>
        ) : (
          row.product && <p className="text-sm text-text-muted">{formatTHB(row.product.price)}</p>
        )}
      </div>
      <QtyInput label={name} value={row.qty} onChange={onQty} />
      <span className="w-20 text-right font-semibold">{formatTHB(row.lineTotal)}</span>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-hover hover:text-danger focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <IconX size={16} aria-hidden />
      </button>
    </li>
  );
}
