import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useState } from "react";

interface QtyInputProps {
  label: string;
  value: number;
  onChange: (qty: number) => void;
}

const stepButton =
  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-border text-text hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none";

/**
 * `− qty +` with small outlined buttons (plan.md → Qty buttons). The number can be typed too;
 * it's applied on Enter or when leaving the box. Going below 1 removes the line.
 */
export function QtyInput({ label, value, onChange }: QtyInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const qty = Number(draft);
    if (draft.trim() !== "" && Number.isInteger(qty)) onChange(qty);
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`One less ${label}`}
        className={stepButton}
        onClick={() => onChange(value - 1)}
      >
        <IconMinus size={14} aria-hidden />
      </button>
      <input
        aria-label={`Quantity of ${label}`}
        inputMode="numeric"
        value={draft ?? String(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        className="h-7 w-11 rounded-lg border-2 border-transparent text-center font-medium hover:border-border focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        aria-label={`One more ${label}`}
        className={stepButton}
        onClick={() => onChange(value + 1)}
      >
        <IconPlus size={14} aria-hidden />
      </button>
    </div>
  );
}
