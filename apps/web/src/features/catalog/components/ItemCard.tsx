import { formatTHB, type Product } from "@pos/shared";
import { clsx } from "clsx";
import { StockBadge } from "./StockBadge";

type ItemCardProduct = Pick<Product, "name" | "price" | "stockQty" | "lowStockAt">;

/**
 * Product card in the checkout grid (plan.md → Item card); also the live preview in Add / Edit item.
 * Out-of-stock items stay clickable — stock may be wrong.
 */
export function ItemCard({ product, className }: { product: ItemCardProduct; className?: string }) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-2 rounded-2xl border-2 border-border bg-page p-4",
        className,
      )}
    >
      <p className="line-clamp-2 min-h-[3.2em] font-medium break-words">{product.name}</p>
      <div>
        <StockBadge product={product} />
      </div>
      <p className="text-right text-lg font-semibold">{formatTHB(product.price)}</p>
    </div>
  );
}
