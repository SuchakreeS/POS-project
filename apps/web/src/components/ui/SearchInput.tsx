import { IconSearch, IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ComponentProps } from "react";

interface SearchInputProps extends Omit<ComponentProps<"input">, "onChange" | "value" | "size"> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; the search bar has no visible label. */
  label: string;
}

/** Pill search bar with an icon and a clear button. Esc clears it. */
export function SearchInput({
  value,
  onChange,
  label,
  className,
  onKeyDown,
  ...props
}: SearchInputProps) {
  return (
    <div className={clsx("relative", className)}>
      <IconSearch
        size={20}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
          onKeyDown?.(event);
        }}
        className={clsx(
          "h-10 w-full rounded-full border-2 border-border bg-surface-alt pr-10 pl-11 text-base text-text transition-colors",
          "placeholder:text-placeholder focus:border-primary focus:bg-page focus:ring-1 focus:ring-primary focus:outline-none",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-hover"
        >
          <IconX size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}
