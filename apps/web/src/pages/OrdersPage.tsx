import {
  formatSatang,
  formatTHB,
  orderFilterCounts,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  statsFor,
  type OrderFilter,
  type OrderStats,
  type OrderSummary,
} from "@pos/shared";
import { IconChevronRight, IconReceipt, IconRefresh, IconSearch } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { DateRangeChip } from "@/components/ui/DateRangeChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { openBill } from "@/features/orders/bill-viewer";
import { BillLink } from "@/features/orders/components/BillLink";
import { plural } from "@/features/orders/orders-view";
import { useOrders } from "@/features/orders/queries";
import {
  formatDayLabel,
  formatTime,
  groupByDay,
  presetRange,
  rangeLabel,
  type DateRange,
} from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const FILTER_LABELS: Record<OrderFilter, string> = {
  ALL: "All",
  ...PAYMENT_METHOD_LABELS,
  VOIDED: "Voided",
};

/** Orders page (plan.md → Orders page): every bill, with its payment and status. */
export function OrdersPage() {
  const [range, setRange] = useState<DateRange>(() => presetRange("today"));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const orders = useOrders({ ...range, search: debouncedSearch, filter });
  const pages = orders.data?.pages;
  const rows = pages?.flatMap((page) => page.items) ?? [];
  const stats = pages?.[0]?.stats;
  const counts = stats ? orderFilterCounts(stats) : undefined;

  return (
    <>
      <PageHeader title="Orders" description="Every bill, with its payment and status" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search bills"
          placeholder="Bill no. or customer name"
          value={search}
          onChange={setSearch}
          className="w-full max-w-sm"
        />
        <DateRangeChip label="Bill dates" value={range} onChange={setRange} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Payment" className="flex flex-wrap gap-2">
          {(["ALL", ...PAYMENT_METHODS] as const).map((option) => (
            <Chip
              key={option}
              selected={filter === option}
              count={counts?.[option]}
              onClick={() => setFilter(option)}
            >
              {FILTER_LABELS[option]}
            </Chip>
          ))}
        </div>
        <span aria-hidden className="mx-2 h-6 w-0.5 bg-border" />
        <Chip
          selected={filter === "VOIDED"}
          count={counts?.VOIDED}
          onClick={() => setFilter(filter === "VOIDED" ? "ALL" : "VOIDED")}
        >
          Voided
        </Chip>
      </div>

      {stats && <SummaryStrip stats={stats} filter={filter} />}

      {orders.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      ) : orders.isError && rows.length === 0 ? (
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load the bills. {errorMessage(orders.error)}
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={16} aria-hidden />}
              onClick={() => orders.refetch()}
            >
              Try again
            </Button>
          </span>
        </Alert>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-border">
          <NoBills search={debouncedSearch} filter={filter} range={range} />
        </div>
      ) : (
        <div className={clsx(orders.isPlaceholderData && "opacity-60 transition-opacity")}>
          <OrdersTable rows={rows} />
          {orders.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                loading={orders.isFetchingNextPage}
                onClick={() => orders.fetchNextPage()}
              >
                Load older bills
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** "12 bills · 4,560.00 ฿ sales · 2 PromptPay pending · 1 voided" for the selected chip. */
function SummaryStrip({ stats, filter }: { stats: OrderStats; filter: OrderFilter }) {
  const row = statsFor(stats, filter);
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl bg-surface-alt px-5 py-3">
      {filter === "VOIDED" ? (
        <span>
          <strong className="font-semibold">{plural(row.voided, "voided bill")}</strong>
          <span className="text-text-muted"> · {formatTHB(row.voidedTotal)}, not in sales</span>
        </span>
      ) : (
        <>
          <span>
            <strong className="font-semibold">{plural(row.bills, "bill")}</strong>
            <span className="text-text-muted"> · </span>
            <strong className="font-semibold">{formatTHB(row.sales)}</strong>
            <span className="text-text-muted"> sales</span>
          </span>
          {row.promptpayPending > 0 && (
            <span className="font-medium text-warning-text">
              {row.promptpayPending} PromptPay pending
            </span>
          )}
          {row.voided > 0 && (
            <span className="font-medium text-danger-text">{row.voided} voided</span>
          )}
        </>
      )}
    </p>
  );
}

function NoBills({
  search,
  filter,
  range,
}: {
  search: string;
  filter: OrderFilter;
  range: DateRange;
}) {
  const when = rangeLabel(range);
  if (search) {
    return (
      <EmptyState
        icon={IconSearch}
        title="No bills found"
        description={`Nothing matches "${search}" (${when}). Check the bill number or try other dates.`}
      />
    );
  }
  if (filter === "VOIDED") {
    return <EmptyState icon={IconReceipt} title="No voided bills" description={when} />;
  }
  return (
    <EmptyState
      icon={IconReceipt}
      title={filter === "ALL" ? "No bills yet" : `No ${FILTER_LABELS[filter]} bills`}
      description={`${when}: sales will show up here.`}
    />
  );
}

function OrdersTable({ rows }: { rows: OrderSummary[] }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-20" />
        <col className="w-48" />
        <col className="w-40" />
        <col />
        <col className="w-36" />
        <col className="w-10" />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-border text-left text-sm text-text-muted">
          <th scope="col" className="px-3 py-2 font-medium">
            Time
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Bill
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Items
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Payment
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            Total
          </th>
          <th scope="col">
            <span className="sr-only">Open</span>
          </th>
        </tr>
      </thead>
      {groupByDay(rows, (row) => row.createdAt).map((group) => (
        <tbody key={group.day}>
          <tr>
            <th
              colSpan={6}
              scope="colgroup"
              className="px-3 pt-4 pb-1 text-left text-sm font-semibold text-text-muted"
            >
              {formatDayLabel(group.day)}
            </th>
          </tr>
          {group.items.map((row) => (
            <OrderRow key={row.id} row={row} />
          ))}
        </tbody>
      ))}
    </table>
  );
}

function OrderRow({ row }: { row: OrderSummary }) {
  const voided = row.status === "VOIDED";
  return (
    // The whole row opens the bill (mouse); the bill number is the real button (keyboard).
    <tr
      onClick={() => openBill(row.id)}
      className={clsx(
        "cursor-pointer border-b-2 border-border hover:bg-surface-alt",
        voided && "text-text-muted",
      )}
    >
      <td className="px-3 py-2.5">{formatTime(row.createdAt)}</td>
      <td className="px-3">
        <span className="inline-flex items-center gap-2">
          <BillLink order={row} prefix="" className={clsx(voided && "text-text-muted")} />
          {voided && <Badge tone="danger">Voided</Badge>}
        </span>
      </td>
      <td className="px-3">
        {plural(row.lineCount, "item")}
        <span className="text-sm text-text-muted"> · {plural(row.pieceCount, "pc")}</span>
      </td>
      <td className="truncate px-3">
        <PaymentCell row={row} />
      </td>
      <td className={clsx("px-3 text-right font-semibold", voided && "line-through")}>
        {formatSatang(row.total)} ฿
      </td>
      <td className="pr-3 text-right text-text-muted">
        <IconChevronRight size={18} aria-hidden className="inline" />
      </td>
    </tr>
  );
}

function PaymentCell({ row }: { row: OrderSummary }) {
  if (row.paymentMethod === "CREDIT") {
    return <>Credit{row.customerName ? ` · ${row.customerName}` : ""}</>;
  }
  if (row.paymentMethod === "PROMPTPAY") {
    return (
      <span className="inline-flex items-center gap-2">
        PromptPay
        {row.status === "COMPLETED" &&
          (row.promptpayStatus === "RECEIVED" ? (
            <Badge tone="success">Received</Badge>
          ) : (
            <Badge tone="warning">Pending</Badge>
          ))}
      </span>
    );
  }
  return <>Cash</>;
}
