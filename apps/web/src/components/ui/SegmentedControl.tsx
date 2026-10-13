import type { TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useRef, type KeyboardEvent } from "react";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: TablerIcon;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
}

/** Pill track with equal options (plan.md → Segmented control). A radio group: arrow keys move. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-hover p-1">
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={clsx(
              "flex h-9 flex-1 items-center justify-center gap-2 rounded-full border-2 text-sm transition-colors",
              "focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none",
              selected
                ? "border-primary bg-page font-semibold text-primary-dark"
                : "border-transparent font-medium text-text-soft hover:text-text",
            )}
          >
            {Icon && <Icon size={18} aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
