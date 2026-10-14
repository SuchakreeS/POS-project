import { formatSatang, formatTHB, type CustomerOverview } from "@pos/shared";
import { IconCircleCheck, IconPlus, IconRefresh, IconUsers } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import {
  CustomerCreditDialog,
  type CustomerDialogStep,
} from "@/features/credit/components/CustomerCreditDialog";
import { CustomerFormDialog } from "@/features/credit/components/CustomerFormDialog";
import {
  ageLabel,
  daysSince,
  filterCustomers,
  initialOf,
  OLD_DEBT_DAYS,
  type CreditFilter,
  type CreditSort,
} from "@/features/credit/credit-view";
import { useCreditBoard } from "@/features/credit/queries";
import { errorMessage } from "@/lib/errors";

type CreditDialog =
  { kind: "add" } | { kind: "customer"; id: string; step: CustomerDialogStep } | null;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Credit page (plan.md → Credit): who owes the shop, and recording their payments. */
export function CreditPage() {
  const board = useCreditBoard();
  const [filter, setFilter] = useState<CreditFilter>({
    search: "",
    view: "owing",
    sort: "highest",
  });
  const [dialog, setDialog] = useState<CreditDialog>(null);

  const update = (change: Partial<CreditFilter>) =>
    setFilter((current) => ({ ...current, ...change }));
  const openCustomer = (id: string, step: CustomerDialogStep) =>
    setDialog({ kind: "customer", id, step });

  const header = (
    <PageHeader
      title="Credit"
      description="Who owes the shop, and how much"
      actions={
        <Button
          variant="secondary"
          icon={<IconPlus size={18} aria-hidden />}
          onClick={() => setDialog({ kind: "add" })}
        >
          Add customer
        </Button>
      }
    />
  );

  const dialogs = (
    <>
      <CustomerFormDialog
        open={dialog?.kind === "add"}
        onClose={() => setDialog(null)}
        // A new customer owes nothing yet: show them under "All" so the cashier sees they're in.
        onSaved={(customer) => update({ view: "all", search: customer.name })}
      />
      <CustomerCreditDialog
        customerId={dialog?.kind === "customer" ? dialog.id : null}
        initialStep={dialog?.kind === "customer" ? dialog.step : undefined}
        onClose={() => setDialog(null)}
      />
    </>
  );

  if (board.isPending) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
        {dialogs}
      </>
    );
  }
  if (board.isError) {
    return (
      <>
        {header}
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load credit customers. {errorMessage(board.error)}
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
        {dialogs}
      </>
    );
  }

  const { stats, customers } = board.data;
  const { rows, counts } = filterCustomers(customers, filter);
  const now = new Date();

  return (
    <>
      {header}

      <div className="mb-5 grid max-w-xl grid-cols-2 gap-4">
        <StatCard
          tone="warning"
          label="Total owed"
          value={formatTHB(stats.totalOwed)}
          detail={plural(stats.owingCount, "person", "people")}
        />
        <StatCard
          tone="success"
          label="Collected today"
          value={formatTHB(stats.collectedToday)}
          detail={plural(stats.collectedTodayCount, "payment")}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search customers"
          placeholder="Search name or phone"
          value={filter.search}
          onChange={(search) => update({ search })}
          className="w-full max-w-sm"
        />
        <div role="group" aria-label="Show" className="flex gap-2">
          <Chip
            selected={filter.view === "owing"}
            count={counts.owing}
            onClick={() => update({ view: "owing" })}
          >
            Owes money
          </Chip>
          <Chip
            selected={filter.view === "all"}
            count={counts.all}
            onClick={() => update({ view: "all" })}
          >
            All
          </Chip>
        </div>
        <Select
          label="Sort customers"
          value={filter.sort}
          onChange={(event) => update({ sort: event.target.value as CreditSort })}
          className="ml-auto"
        >
          <option value="highest">Highest first</option>
          <option value="oldest">Oldest debt</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-border">
          <NoRows filter={filter} hasCustomers={customers.length > 0} />
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-40" />
            <col className="w-44" />
            <col className="w-48" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-border text-left text-sm text-text-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Owes
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Oldest unpaid
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                now={now}
                onOpen={() => openCustomer(customer.id, "history")}
                onRecordPayment={() => openCustomer(customer.id, "payment")}
              />
            ))}
          </tbody>
        </table>
      )}

      {dialogs}
    </>
  );
}

function NoRows({ filter, hasCustomers }: { filter: CreditFilter; hasCustomers: boolean }) {
  if (filter.search.trim()) {
    return (
      <EmptyState
        icon={IconUsers}
        title="No customers found"
        description={`Nobody matches "${filter.search.trim()}"`}
      />
    );
  }
  if (!hasCustomers) {
    return (
      <EmptyState
        icon={IconUsers}
        title="No credit customers yet"
        description="Credit sales will show up here"
      />
    );
  }
  return (
    <EmptyState
      icon={IconCircleCheck}
      tone="success"
      title="Nobody owes money"
      description="Credit sales will show up here"
    />
  );
}

function CustomerRow({
  customer,
  now,
  onOpen,
  onRecordPayment,
}: {
  customer: CustomerOverview;
  now: Date;
  onOpen: () => void;
  onRecordPayment: () => void;
}) {
  const owes = customer.balance > 0;
  const age = customer.oldestUnpaidAt ? daysSince(customer.oldestUnpaidAt, now) : null;

  return (
    // The whole row opens the customer (mouse); the name is the real button (keyboard).
    <tr onClick={onOpen} className="cursor-pointer border-b-2 border-border hover:bg-surface-alt">
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="flex max-w-full items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-dark"
          >
            {initialOf(customer.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{customer.name}</span>
            {customer.phone && (
              <span className="block truncate text-sm text-text-muted">{customer.phone}</span>
            )}
          </span>
        </button>
      </td>
      <td className="px-3 text-right">
        {customer.balance < 0 ? (
          <span className="text-sm text-success-text">
            Paid ahead {formatSatang(-customer.balance)} ฿
          </span>
        ) : owes ? (
          <span className="font-semibold">{formatSatang(customer.balance)} ฿</span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="px-3">
        {age === null ? (
          <span className="text-text-muted">—</span>
        ) : age >= OLD_DEBT_DAYS ? (
          <Badge tone="warning">{ageLabel(age)}</Badge>
        ) : (
          <span className="text-text-soft">{ageLabel(age)}</span>
        )}
      </td>
      <td className="px-3 text-right">
        {owes && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onRecordPayment();
            }}
          >
            Record payment
          </Button>
        )}
      </td>
    </tr>
  );
}
