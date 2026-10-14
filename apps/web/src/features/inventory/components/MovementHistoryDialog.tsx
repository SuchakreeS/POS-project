import type { Movement, MovementFilter, MovementType, Product } from "@pos/shared";
import { IconHistory } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProduct } from "@/features/catalog/queries";
import { BillLink } from "@/features/orders/components/BillLink";
import { formatDayLabel, formatTime, groupByDay } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { useMovements } from "../queries";

export interface MovementHistoryDialogProps {
  /** The item; null = closed. */
  productId: string | null;
  onClose: () => void;
}

const FILTERS: { value: MovementFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sales", label: "Sales" },
  { value: "restock", label: "Restock" },
  { value: "adjust", label: "Adjust" },
];

/** Badge colors from plan.md → Badges: sales neutral, stock in green, adjust amber, never blue. */
const TYPES: Record<MovementType, { label: string; tone: BadgeTone }> = {
  INITIAL: { label: "Opening stock", tone: "success" },
  RESTOCK: { label: "Restock", tone: "success" },
  SALE: { label: "Sale", tone: "neutral" },
  VOID_RETURN: { label: "Void return", tone: "neutral" },
  ADJUST: { label: "Adjust", tone: "warning" },
};

/** Movement history (plan.md → Movement history dialog). Read-only. Standalone: takes an id. */
export function MovementHistoryDialog({ productId, onClose }: MovementHistoryDialogProps) {
  const { data: product } = useProduct(productId);
  const [filter, setFilter] = useState<MovementFilter>("all");
  if (!productId) return null;

  return (
    <Dialog
      open
      size="xl"
      title="Movement history"
      description={product && describe(product)}
      onClose={() => {
        setFilter("all");
        onClose();
      }}
    >
      <div role="group" aria-label="Show" className="mb-4 flex gap-2">
        {FILTERS.map((option) => (
          <Chip
            key={option.value}
            selected={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      <MovementTable productId={productId} filter={filter} />
    </Dialog>
  );
}

function describe(product: Product) {
  return [product.name, product.sku, `Stock ${product.stockQty.toLocaleString("en-US")} pcs`]
    .filter(Boolean)
    .join(" · ");
}

function MovementTable({ productId, filter }: { productId: string; filter: MovementFilter }) {
  const query = useMovements(productId, filter);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-6 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) return <Alert tone="danger">{errorMessage(query.error)}</Alert>;

  const movements = query.data.pages.flatMap((page) => page.items);
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        title="Nothing here yet"
        description="Stock changes will show up here."
      />
    );
  }

  return (
    <>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-16" />
          <col className="w-36" />
          <col className="w-20" />
          <col className="w-16" />
          <col className="w-28" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-border text-left text-sm text-text-muted">
            <th scope="col" className="px-2 py-2 font-medium">
              Time
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Type
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Change
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              After
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              By
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Details
            </th>
          </tr>
        </thead>
        {groupByDay(movements, (movement) => movement.createdAt).map((group) => (
          <tbody key={group.day}>
            <tr>
              <th
                colSpan={6}
                scope="colgroup"
                className="px-2 pt-4 pb-1 text-left text-sm font-semibold text-text-muted"
              >
                {formatDayLabel(group.day)} · {group.items.length}
              </th>
            </tr>
            {group.items.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </tbody>
        ))}
      </table>
      {query.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            Load older
          </Button>
        </div>
      )}
    </>
  );
}

function MovementRow({ movement }: { movement: Movement }) {
  const type = TYPES[movement.type];
  return (
    <tr className="border-b-2 border-border">
      <td className="px-2 py-2 text-text-muted">{formatTime(movement.createdAt)}</td>
      <td className="px-2">
        <Badge tone={type.tone}>{type.label}</Badge>
      </td>
      <td
        className={clsx("px-2 text-right font-semibold", movement.qty > 0 && "text-success-text")}
      >
        {movement.qty > 0
          ? `+${movement.qty.toLocaleString("en-US")}`
          : `−${Math.abs(movement.qty).toLocaleString("en-US")}`}
      </td>
      <td className="px-2 text-right">{movement.stockAfter.toLocaleString("en-US")}</td>
      <td className="truncate px-2" title={movement.userName}>
        {movement.userName}
      </td>
      <td className="truncate px-2 text-text-muted" title={details(movement)}>
        {movement.order ? <BillLink order={movement.order} /> : details(movement)}
      </td>
    </tr>
  );
}

function details(movement: Movement): string {
  if (movement.order) return `Bill ${movement.order.billNo}`;
  if (movement.type === "INITIAL") return "Item created";
  return movement.reason ?? "";
}
