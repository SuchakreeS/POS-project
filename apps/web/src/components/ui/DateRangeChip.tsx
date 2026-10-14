import { addDays, bangkokDateKey, MAX_ORDER_RANGE_DAYS } from "@pos/shared";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { clsx } from "clsx";
import { Popover } from "radix-ui";
import { useState, type FormEvent } from "react";
import {
  DATE_PRESET_LABELS,
  DATE_PRESETS,
  presetOf,
  presetRange,
  rangeLabel,
  type DateRange,
} from "@/lib/datetime";
import { Button } from "./Button";
import { TextField } from "./TextField";

/**
 * Date chip (plan.md → Orders page: "Today ▾"): quick picks, or any day or range up to today.
 * Highlighted like an active filter when it isn't "Today".
 */
export function DateRangeChip({
  value,
  onChange,
  label = "Dates",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Accessible name, e.g. "Bill dates". */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = presetOf(value) !== "today";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${rangeLabel(value)}`}
        className={clsx(
          "inline-flex h-9 items-center gap-2 rounded-full border-2 pr-3 pl-4 text-sm font-medium whitespace-nowrap transition-colors",
          "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
          active
            ? "border-primary bg-primary-tint text-primary-dark"
            : "border-border-strong bg-page text-text hover:bg-hover",
        )}
      >
        <IconCalendar size={18} aria-hidden />
        {rangeLabel(value)}
        <IconChevronDown size={18} aria-hidden className="text-text-soft" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-label={label}
          className="z-50 w-80 rounded-2xl border-2 border-border bg-page p-4 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          <RangePicker
            value={value}
            onPick={(range) => {
              onChange(range);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Mounted only while open, so it starts from the current value every time. */
function RangePicker({ value, onPick }: { value: DateRange; onPick: (range: DateRange) => void }) {
  const today = bangkokDateKey();
  const current = presetOf(value);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const [error, setError] = useState<string>();

  const apply = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation(); // the page may be inside a form of its own
    if (!from || !to) return setError("Pick both dates");
    if (from > to) return setError("The end date is before the start date");
    if (to > today) return setError("Pick a date up to today");
    if (to > addDays(from, MAX_ORDER_RANGE_DAYS - 1))
      return setError(`Pick at most ${MAX_ORDER_RANGE_DAYS} days`);
    onPick({ from, to });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={current === preset}
            onClick={() => onPick(presetRange(preset))}
            className={clsx(
              "h-10 rounded-xl border-2 px-3 text-sm font-medium transition-colors",
              "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
              current === preset
                ? "border-primary bg-primary-tint text-primary-dark"
                : "border-border bg-page hover:bg-hover",
            )}
          >
            {DATE_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>

      <form onSubmit={apply} className="flex flex-col gap-3 border-t-2 border-border pt-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="From"
            type="date"
            max={today}
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setError(undefined);
            }}
          />
          <TextField
            label="To"
            type="date"
            max={today}
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setError(undefined);
            }}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="secondary" size="sm">
          Show these dates
        </Button>
      </form>
    </div>
  );
}
