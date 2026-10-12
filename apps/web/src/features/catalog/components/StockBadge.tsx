import { stockStatus, type Product } from "@pos/shared";
import { Badge } from "@/components/ui/Badge";

type StockInfo = Pick<Product, "stockQty" | "lowStockAt">;

/** Available / Low / Out of stock pill (plan.md → Stock badge). */
export function StockBadge({ product }: { product: StockInfo }) {
  switch (stockStatus(product)) {
    case "OUT":
      return <Badge tone="danger">Out of stock</Badge>;
    case "LOW":
      return <Badge tone="warning">Low: {product.stockQty.toLocaleString("en-US")}</Badge>;
    default:
      return <Badge tone="success">Available: {product.stockQty.toLocaleString("en-US")}</Badge>;
  }
}

/** Stock cell in tables: a plain number when normal, a badge when Low or Out (plan.md → Stock page). */
export function StockCell({ product }: { product: StockInfo }) {
  return stockStatus(product) === "OK" ? (
    <span>{product.stockQty.toLocaleString("en-US")}</span>
  ) : (
    <StockBadge product={product} />
  );
}
