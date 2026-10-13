import { formatTHB, type Product } from "@pos/shared";
import { clsx } from "clsx";
import { StockBadge } from "./StockBadge";

type ItemCardProduct = Pick<Product, "name" | "price" | "stockQty" | "lowStockAt">;

interface ItemCardProps {
  product: ItemCardProduct;
  /** Clickable card in the checkout grid. Without it, a static preview (Add / Edit item). */
  onClick?: () => void;
  /** Last scanned item (plan.md → Item card: Selected). */
  selected?: boolean;
  className?: string;
}

/**
 * Product card in the checkout grid (plan.md → Item card); also the live preview in Add / Edit item.
 * Out-of-stock items stay clickable — stock may be wrong — and keep their red badge when selected.
 */
export function ItemCard({ product, onClick, selected, className }: ItemCardProps) {
  const body = (
    <>
      <span className="line-clamp-2 min-h-[3.2em] text-left font-medium break-words">
        {product.name}
      </span>
      <span className="block">
        <StockBadge product={product} />
      </span>
      <span className="block text-right text-lg font-semibold">{formatTHB(product.price)}</span>
    </>
  );
  const frame = clsx(
    "flex flex-col gap-2 rounded-2xl border-2 p-4",
    selected ? "border-primary bg-primary-tint" : "border-border bg-page",
    className,
  );

  if (!onClick) return <div className={frame}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        frame,
        "w-full cursor-pointer transition-colors hover:border-primary",
        "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
      )}
    >
      {body}
    </button>
  );
}
