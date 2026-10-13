import { formatSatang, formatTHB, sameAmountIds, type PromptPayBill } from "@pos/shared";
import { IconArrowBackUp, IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { toast } from "@/components/ui/toast";
import { UndoReceivedDialog } from "@/features/promptpay/components/UndoReceivedDialog";
import { billsFor, selectionOf, type PromptPayView } from "@/features/promptpay/promptpay-view";
import { useMarkReceived, usePromptPayBoard } from "@/features/promptpay/queries";
import { formatDayLabel, formatTime, groupByDay } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";

/** PromptPay check page (plan.md → PromptPay): match bills with the bank app, mark them received. */
export function PromptPayPage() {
  const board = usePromptPayBoard();
  const markReceived = useMarkReceived();
  const [view, setView] = useState<PromptPayView>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undoing, setUndoing] = useState<PromptPayBill | null>(null);

  const sameAmount = useMemo(() => sameAmountIds(board.data?.pending ?? []), [board.data]);

  const receive = (ids: string[]) =>
    markReceived.mutate(ids, {
      onSuccess: (bills) => {
        setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
        toast.success(
          bills.length === 1
            ? `Bill ${bills[0]?.billNo} marked received`
            : `${bills.length} bills marked received`,
        );
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (board.isPending) {
    return (
      <>
        <Header />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      </>
    );
  }
  if (board.isError) {
    return (
      <>
        <Header />
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load PromptPay bills. {errorMessage(board.error)}
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={16} aria-hidden />}
              onClick={() => board.refetch()}
            >
              Try again
            </Button>
          </span>
        </Alert>
      </>
    );
  }

  const { stats } = board.data;
  const rows = billsFor(board.data, view);
  const selection = selectionOf(board.data, selected);
  const pendingShown = rows.filter((bill) => bill.status === "PENDING");
  const allPendingSelected =
    pendingShown.length > 0 && pendingShown.every((bill) => selected.has(bill.orderId));

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <div className="mb-5 grid max-w-xl grid-cols-2 gap-4">
        <StatCard
          tone="warning"
          label="Pending"
          value={formatTHB(stats.pendingTotal)}
          detail={`${stats.pendingCount} bill${stats.pendingCount === 1 ? "" : "s"} to check`}
        />
        <StatCard
          tone="success"
          label="Received today"
          value={formatTHB(stats.receivedTodayTotal)}
          detail={`${stats.receivedTodayCount} bill${stats.receivedTodayCount === 1 ? "" : "s"}`}
        />
      </div>

      <div role="group" aria-label="Show" className="mb-4 flex gap-2">
        <Chip
          selected={view === "pending"}
          count={stats.pendingCount}
          onClick={() => setView("pending")}
        >
          Pending
        </Chip>
        <Chip
          selected={view === "received"}
          count={stats.receivedTodayCount}
          onClick={() => setView("received")}
        >
          Received today
        </Chip>
        <Chip selected={view === "all"} onClick={() => setView("all")}>
          All
        </Chip>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-border">
          {view === "received" ? (
            <EmptyState icon={IconCircleCheck} title="Nothing received yet today" />
          ) : (
            <EmptyState
              icon={IconCircleCheck}
              tone="success"
              title="All caught up"
              description="No PromptPay bills waiting to be checked"
            />
          )}
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            <col className="w-20" />
            <col className="w-36" />
            <col className="w-48" />
            <col />
            <col className="w-80" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-border text-left text-sm text-text-muted">
              <th scope="col" className="px-3 py-2">
                {pendingShown.length > 0 && (
                  <Checkbox
                    label="Select all pending bills"
                    checked={allPendingSelected}
                    indeterminate={!allPendingSelected && selection.ids.length > 0}
                    onChange={() =>
                      setSelected(
                        allPendingSelected
                          ? new Set()
                          : new Set(pendingShown.map((bill) => bill.orderId)),
                      )
                    }
                  />
                )}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Time
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Bill
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Amount
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Cashier
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          {groupByDay(rows, (bill) => bill.createdAt).map((group) => (
            <tbody key={group.day}>
              <tr>
                <th
                  colSpan={6}
                  scope="colgroup"
                  className="px-3 pt-4 pb-1 text-left text-sm font-semibold text-text-muted"
                >
                  {formatDayLabel(group.day)} · {group.items.length} bill
                  {group.items.length === 1 ? "" : "s"}
                </th>
              </tr>
              {group.items.map((bill) => (
                <BillRow
                  key={bill.orderId}
                  bill={bill}
                  selected={selected.has(bill.orderId)}
                  sameAmount={sameAmount.has(bill.orderId)}
                  busy={markReceived.isPending}
                  onToggle={() => toggle(bill.orderId)}
                  onReceive={() => receive([bill.orderId])}
                  onUndo={() => setUndoing(bill)}
                />
              ))}
            </tbody>
          ))}
        </table>
      )}

      {selection.ids.length > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center gap-4 self-center rounded-full border-2 border-border bg-surface-alt py-2 pr-2 pl-6 shadow-lg">
          <span className="font-medium">
            {selection.ids.length} selected · {formatTHB(selection.total)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
          <Button loading={markReceived.isPending} onClick={() => receive(selection.ids)}>
            Mark {selection.ids.length} as received
          </Button>
        </div>
      )}

      <UndoReceivedDialog bill={undoing} onClose={() => setUndoing(null)} />
    </div>
  );
}

function Header() {
  return (
    <PageHeader
      title="PromptPay"
      description="Match each bill with your bank app, then mark it received."
    />
  );
}

function BillRow({
  bill,
  selected,
  sameAmount,
  busy,
  onToggle,
  onReceive,
  onUndo,
}: {
  bill: PromptPayBill;
  selected: boolean;
  sameAmount: boolean;
  busy: boolean;
  onToggle: () => void;
  onReceive: () => void;
  onUndo: () => void;
}) {
  const pending = bill.status === "PENDING";
  return (
    <tr
      className={clsx(
        "border-b-2 border-border",
        selected ? "bg-primary-tint" : "hover:bg-surface-alt",
      )}
    >
      <td className="px-3 py-2">
        {pending && (
          <Checkbox label={`Select bill ${bill.billNo}`} checked={selected} onChange={onToggle} />
        )}
      </td>
      <td className="px-3 text-text-muted">{formatTime(bill.createdAt)}</td>
      <td className="px-3 font-medium">{bill.billNo}</td>
      <td className="px-3 text-right">
        <span className="inline-flex items-center gap-2">
          {sameAmount && pending && (
            <span
              title="Another pending bill has the same amount close in time — match it carefully"
              className="rounded-full bg-warning-tint px-2 text-xs font-medium whitespace-nowrap text-warning-text"
            >
              Same amount
            </span>
          )}
          <span className="font-semibold">{formatSatang(bill.total)} ฿</span>
        </span>
      </td>
      <td className="truncate px-3">{bill.cashierName}</td>
      <td className="px-3 text-right">
        {pending ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onReceive}>
            Mark received
          </Button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Badge tone="success">
              Received {bill.receivedAt ? formatTime(bill.receivedAt) : ""}
              {bill.receivedBy ? ` · ${bill.receivedBy}` : ""}
            </Badge>
            <button
              type="button"
              aria-label={`Undo received for bill ${bill.billNo}`}
              title="Not received after all"
              onClick={onUndo}
              className="inline-flex size-8 items-center justify-center rounded-full text-text-soft hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <IconArrowBackUp size={18} aria-hidden />
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
