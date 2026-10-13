import { barcodeSchema, formatTHB, type Product } from "@pos/shared";
import {
  IconAdjustments,
  IconDots,
  IconHistory,
  IconTruckDelivery,
  IconEyeOff,
  IconPackageOff,
  IconPencil,
  IconPlus,
  IconPower,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AddItemDialog } from "@/features/catalog/components/AddItemDialog";
import { DeactivateItemDialog } from "@/features/catalog/components/DeactivateItemDialog";
import { EditItemDialog } from "@/features/catalog/components/EditItemDialog";
import { StockCell } from "@/features/catalog/components/StockBadge";
import { useCategories, useProducts } from "@/features/catalog/queries";
import {
  filterStock,
  NO_CATEGORY,
  type StockFilter,
  type StockView,
} from "@/features/catalog/stock-filter";
import { AdjustStockDialog } from "@/features/inventory/components/AdjustStockDialog";
import { MovementHistoryDialog } from "@/features/inventory/components/MovementHistoryDialog";
import { RestockDialog } from "@/features/inventory/components/RestockDialog";
import { useShopSettings } from "@/features/settings/queries";
import { errorMessage } from "@/lib/errors";

const VIEWS: { view: StockView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "low", label: "Low" },
  { view: "out", label: "Out" },
  { view: "off", label: "Turned off" },
];

/** Stock (plan.md → Stock page): the product list and the way into every item dialog. */
export function StockPage() {
  const products = useProducts();
  const { data: categories = [] } = useCategories();
  useShopSettings(); // warm the cache: Add new item pre-fills the low-stock alert from it

  const [filter, setFilter] = useState<StockFilter>({ search: "", view: "all", category: "" });
  const [dialog, setDialog] = useState<StockDialog | null>(null);
  const close = () => setDialog(null);
  const open = (next: StockDialog) => () => setDialog(next);

  const { rows, counts } = filterStock(products.data ?? [], filter);
  const update = (change: Partial<StockFilter>) =>
    setFilter((current) => ({ ...current, ...change }));

  // A scan or typed text that could be a barcode gets offered to "Add new item".
  const searchAsBarcode = barcodeSchema.safeParse(filter.search).success
    ? filter.search.trim()
    : undefined;

  return (
    <>
      <PageHeader
        title="Stock"
        description="Every item you sell, and how many are left"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<IconPlus size={18} aria-hidden />}
              onClick={open({ kind: "add" })}
            >
              Add new item
            </Button>
            <Button
              icon={<IconTruckDelivery size={18} aria-hidden />}
              onClick={open({ kind: "restock" })}
            >
              Restock
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search items"
          placeholder="Search name, SKU, or scan barcode"
          value={filter.search}
          onChange={(search) => update({ search })}
          // After a scan (barcode + Enter) select the text, so the next scan replaces it.
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.select()}
          autoFocus
          className="w-full max-w-sm"
        />
        <div role="group" aria-label="Filter by stock" className="flex flex-wrap gap-2">
          {VIEWS.map(({ view, label }) => (
            <Chip
              key={view}
              selected={filter.view === view}
              count={products.data ? counts[view] : undefined}
              onClick={() => update({ view })}
            >
              {label}
            </Chip>
          ))}
        </div>
        <Select
          label="Filter by category"
          value={filter.category}
          active={filter.category !== ""}
          onChange={(event) => update({ category: event.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={NO_CATEGORY}>No category</option>
        </Select>
      </div>

      {products.isError ? (
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load the items. {errorMessage(products.error)}
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={16} aria-hidden />}
              onClick={() => products.refetch()}
            >
              Try again
            </Button>
          </span>
        </Alert>
      ) : (
        <StockTable
          loading={products.isPending}
          rows={rows}
          onAction={(kind, product) =>
            setDialog(kind === "status" ? { kind, product } : { kind, productId: product.id })
          }
          empty={
            (products.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={IconPackageOff}
                title="No items yet"
                description="Add your first item to start selling."
                action={<AddButton onClick={open({ kind: "add" })} />}
              />
            ) : filter.search ? (
              <EmptyState
                icon={IconSearch}
                title={`No items match “${filter.search.trim()}”`}
                description="Check the spelling or scan it again."
                action={<AddButton onClick={open({ kind: "add", barcode: searchAsBarcode })} />}
              />
            ) : (
              <EmptyState icon={IconPackageOff} title={EMPTY_VIEW_TITLES[filter.view]} />
            )
          }
        />
      )}

      <AddItemDialog
        open={dialog?.kind === "add"}
        initialBarcode={dialog?.kind === "add" ? dialog.barcode : undefined}
        onClose={close}
      />
      <EditItemDialog
        productId={dialog?.kind === "edit" ? dialog.productId : null}
        onClose={close}
        onRestock={(productId) => setDialog({ kind: "restock", productId })}
        onAdjust={(productId) => setDialog({ kind: "adjust", productId })}
      />
      <RestockDialog
        open={dialog?.kind === "restock"}
        initialProductId={dialog?.kind === "restock" ? dialog.productId : null}
        onClose={close}
      />
      <AdjustStockDialog
        productId={dialog?.kind === "adjust" ? dialog.productId : null}
        onClose={close}
      />
      <MovementHistoryDialog
        productId={dialog?.kind === "history" ? dialog.productId : null}
        onClose={close}
      />
      <DeactivateItemDialog
        product={dialog?.kind === "status" ? dialog.product : null}
        onClose={close}
      />
    </>
  );
}

/** One dialog at a time; each item dialog is standalone and only needs the product id. */
type StockDialog =
  | { kind: "add"; barcode?: string }
  | { kind: "restock"; productId?: string }
  | { kind: "edit" | "adjust" | "history"; productId: string }
  | { kind: "status"; product: Product };

type RowAction = "edit" | "restock" | "adjust" | "history" | "status";

const EMPTY_VIEW_TITLES: Record<StockView, string> = {
  all: "No items in this category",
  low: "Nothing is low on stock",
  out: "Nothing is out of stock",
  off: "No turned-off items",
};

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" icon={<IconPlus size={18} aria-hidden />} onClick={onClick}>
      Add new item
    </Button>
  );
}

interface StockTableProps {
  loading: boolean;
  rows: Product[];
  empty: ReactNode;
  onAction: (action: RowAction, product: Product) => void;
}

/** A real <table> so header and rows always share column widths (plan.md → Stock page → Alignment). */
function StockTable({ loading, rows, empty, onAction }: StockTableProps) {
  if (!loading && rows.length === 0)
    return <div className="rounded-2xl border-2 border-border">{empty}</div>;

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-40" />
        <col className="w-40" />
        <col className="w-32" />
        <col className="w-36" />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-border text-left text-sm font-medium text-text-muted">
          <th scope="col" className="px-3 py-2 font-medium">
            Product
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            SKU
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Stock
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Price
          </th>
          <th scope="col" className="px-3 py-2">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {loading
          ? [0, 1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-b-2 border-border">
                <td className="px-3 py-3.5">
                  <Skeleton className="h-4 w-2/3" />
                </td>
                <td className="px-3">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-3">
                  <Skeleton className="h-4 w-12" />
                </td>
                <td className="px-3">
                  <Skeleton className="ml-auto h-4 w-16" />
                </td>
                <td />
              </tr>
            ))
          : rows.map((product) => (
              <StockRow key={product.id} product={product} onAction={onAction} />
            ))}
      </tbody>
    </table>
  );
}

function StockRow({
  product,
  onAction,
}: {
  product: Product;
  onAction: (action: RowAction, product: Product) => void;
}) {
  const act = (action: RowAction) => () => onAction(action, product);
  return (
    <tr
      className={clsx(
        "border-b-2 border-border hover:bg-surface-alt",
        !product.isActive && "text-text-muted",
      )}
    >
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={act("edit")}
          title={product.name}
          className="block max-w-full truncate rounded text-left font-medium hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {product.name}
        </button>
        {product.category && (
          <span className="block truncate text-sm text-text-muted">{product.category.name}</span>
        )}
      </td>
      <td className="truncate px-3 text-text-muted">{product.sku}</td>
      <td className="px-3">
        {product.isActive ? (
          <StockCell product={product} />
        ) : (
          <Badge tone="neutral">Turned off</Badge>
        )}
      </td>
      <td className="px-3 text-right font-semibold">{formatTHB(product.price)}</td>
      <td className="px-3 text-right">
        <span className="inline-flex items-center gap-2">
          {product.isActive && <LinkButton onClick={act("restock")}>Restock</LinkButton>}
          <Menu
            trigger={
              <button
                type="button"
                aria-label={`Actions for ${product.name}`}
                className="inline-flex size-9 items-center justify-center rounded-full text-text-soft hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none data-[state=open]:bg-hover"
              >
                <IconDots size={20} aria-hidden />
              </button>
            }
          >
            <MenuItem icon={IconPencil} onSelect={act("edit")}>
              Edit item
            </MenuItem>
            <MenuItem icon={IconAdjustments} onSelect={act("adjust")}>
              Adjust stock
            </MenuItem>
            <MenuItem icon={IconHistory} onSelect={act("history")}>
              Movement history
            </MenuItem>
            <MenuSeparator />
            {product.isActive ? (
              <MenuItem icon={IconEyeOff} danger onSelect={act("status")}>
                Deactivate item
              </MenuItem>
            ) : (
              <MenuItem icon={IconPower} onSelect={act("status")}>
                Turn back on
              </MenuItem>
            )}
          </Menu>
        </span>
      </td>
    </tr>
  );
}
