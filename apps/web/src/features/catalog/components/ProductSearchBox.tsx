import { barcodeSchema, formatTHB, type Product } from "@pos/shared";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { errorBeep } from "@/lib/beep";
import { isApiError } from "@/lib/http-client";
import { catalogApi } from "../catalog-api";
import { matchesSearch } from "../stock-filter";
import { StockBadge } from "./StockBadge";

export type PickSource = "scan" | "search";

/** Lets a page drive the box: focus it, or feed it a barcode captured elsewhere. */
export interface ProductSearchBoxHandle {
  focus(): void;
  scan(code: string): void;
}

interface ProductSearchBoxProps {
  /** Every loaded product (active and turned off). Suggestions show active ones only. */
  products: readonly Product[];
  /** "scan" = exact barcode + Enter (keep focus here for the next scan); "search" = picked by name. */
  onPick: (product: Product, source: PickSource) => void;
  /** Offered when a barcode isn't in the system ("+ Add as new item"). */
  onAddNew?: (barcode: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Focus it or feed it a scan from outside (see ProductSearchBoxHandle). */
  handleRef?: Ref<ProductSearchBoxHandle>;
  /**
   * Show matches as a list under the box (Restock). Checkout turns this off and filters its
   * product grid instead (via onQueryChange); there Enter adds an item only when exactly one matches.
   */
  showSuggestions?: boolean;
  onQueryChange?: (query: string) => void;
}

const MAX_SUGGESTIONS = 6;

/**
 * Scan or search box (plan.md → Scanner and keyboard, Unknown barcode). The scanner types the
 * barcode then Enter. Unknown barcodes beep and show a red banner with "+ Add as new item".
 */
export function ProductSearchBox({
  products,
  onPick,
  onAddNew,
  label = "Scan or search items",
  placeholder = "Scan a barcode or type a name",
  autoFocus,
  handleRef,
  showSuggestions = true,
  onQueryChange,
}: ProductSearchBoxProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const suggestions = query.trim()
    ? products
        .filter((product) => product.isActive && matchesSearch(product, query))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const changeQuery = (value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  };

  const reset = () => {
    changeQuery("");
    setActive(0);
    setNotFound(null);
    setProblem(null);
  };

  const pick = (product: Product, source: PickSource) => {
    if (!product.isActive) {
      errorBeep();
      setProblem(`${product.name} is turned off. Turn it back on in Stock first.`);
      changeQuery("");
      return;
    }
    reset();
    onPick(product, source);
  };

  const lookUpBarcode = async (code: string) => {
    setLooking(true);
    try {
      pick(await catalogApi.getByBarcode(code), "scan"); // added since the list was loaded?
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) throw error;
      errorBeep();
      setNotFound(code);
      changeQuery("");
    } finally {
      setLooking(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Escape" && (notFound || problem)) {
      event.preventDefault();
      event.stopPropagation(); // dismiss the banner, not the dialog
      setNotFound(null);
      setProblem(null);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit(query, true);
  };

  /** Enter: exact barcode → that item; else the highlighted match; else ask the API about the barcode. */
  const submit = (text: string, allowMatches: boolean) => {
    const code = text.trim();
    if (!code || looking) return;
    const exact = products.find((product) => product.barcode?.toLowerCase() === code.toLowerCase());
    if (exact) return pick(exact, "scan");
    const suggestion = !allowMatches
      ? undefined
      : showSuggestions
        ? suggestions[active]
        : suggestions.length === 1
          ? suggestions[0]
          : undefined;
    if (suggestion) return pick(suggestion, "search");
    if (barcodeSchema.safeParse(code).success) void lookUpBarcode(code);
  };

  const ownInput = useRef<HTMLInputElement>(null);
  useImperativeHandle(handleRef, () => ({
    focus: () => ownInput.current?.focus(),
    scan: (code) => {
      ownInput.current?.focus();
      submit(code, false);
    },
  }));

  const activeId = showSuggestions && suggestions[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className={clsx(notFound && "[&_input]:border-danger")}>
        <SearchInput
          ref={ownInput}
          label={label}
          placeholder={placeholder}
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          onChange={(value) => {
            changeQuery(value);
            setActive(0);
            setProblem(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching items"
          className="rounded-2xl border-2 border-border p-1"
        >
          {suggestions.map((product, index) => (
            <li
              key={product.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()} // keep focus in the box
              onClick={() => pick(product, "search")}
              className={clsx(
                "flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3",
                index === active && "bg-hover",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{product.name}</span>
              <StockBadge product={product} />
              <span className="w-24 text-right text-text-muted">{formatTHB(product.price)}</span>
            </li>
          ))}
        </ul>
      )}

      {notFound && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger-tint px-4 py-3 text-danger-text"
        >
          <IconAlertCircle size={20} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">Barcode not found</span> — {notFound} isn't in the
            system yet.
          </span>
          {onAddNew && (
            <Button
              size="sm"
              variant="secondary"
              icon={<IconPlus size={16} aria-hidden />}
              onClick={() => onAddNew(notFound)}
            >
              Add as new item
            </Button>
          )}
          <span className="text-sm opacity-80">Esc to dismiss</span>
        </div>
      )}

      {problem && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <IconAlertCircle size={16} aria-hidden />
          {problem}
        </p>
      )}
    </div>
  );
}
