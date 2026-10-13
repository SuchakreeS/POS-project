import { CUSTOMER_NAME_MAX, customerNameKey, formatTHB, type CustomerSummary } from "@pos/shared";
import { IconPlus, IconUser } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useId, useState, type KeyboardEvent } from "react";
import { LinkButton } from "@/components/ui/LinkButton";
import { TextField } from "@/components/ui/TextField";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { CustomerChoice } from "../customer-choice";
import { useCustomerSearch } from "../queries";

interface CustomerPickerProps {
  value: CustomerChoice | null;
  onChange: (choice: CustomerChoice | null) => void;
  error?: string;
}

type Option = { kind: "existing"; customer: CustomerSummary } | { kind: "new"; name: string };

/**
 * "Customer name" with autocomplete (plan.md → Payment dialog → Credit): each match shows what
 * that person already owes; the last option adds a new customer with the typed name.
 */
export function CustomerPicker({ value, onChange, error }: CustomerPickerProps) {
  const listId = useId();
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const search = useDebouncedValue(text.trim(), 150);
  const { data: matches = [] } = useCustomerSearch(search, { enabled: search.length > 0 });

  if (value) {
    const name = value.kind === "existing" ? value.customer.name : value.name;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Customer</span>
        <div className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary-tint px-4 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-page font-semibold text-primary-dark">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{name}</span>
            <span className="text-sm text-text-muted">
              {value.kind === "new" ? "New customer" : `Owes ${formatTHB(value.customer.balance)}`}
            </span>
          </span>
          <LinkButton
            onClick={() => {
              setText(name);
              onChange(null);
            }}
          >
            Change
          </LinkButton>
        </div>
      </div>
    );
  }

  const typed = text.trim();
  const exact = matches.some(
    (customer) => customerNameKey(customer.name) === customerNameKey(typed),
  );
  const options: Option[] = [
    ...(search === typed ? matches : []).map((customer): Option => ({
      kind: "existing",
      customer,
    })),
    ...(typed && !exact ? [{ kind: "new", name: typed.replace(/\s+/g, " ") } as Option] : []),
  ];

  const choose = (option: Option) => onChange(option);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault(); // pick, don't submit the payment yet
      const option = options[Math.min(active, options.length - 1)];
      if (option) choose(option);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Customer name"
        required
        autoFocus
        autoComplete="off"
        maxLength={CUSTOMER_NAME_MAX}
        placeholder="Type to search or add"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          options.length > 0 ? `${listId}-${Math.min(active, options.length - 1)}` : undefined
        }
        value={text}
        error={error}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Customers"
          className="rounded-2xl border-2 border-border p-1"
        >
          {options.map((option, index) => (
            <li
              key={option.kind === "existing" ? option.customer.id : "new"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={clsx(
                "flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3",
                index === active && "bg-hover",
              )}
            >
              {option.kind === "existing" ? (
                <>
                  <IconUser size={18} aria-hidden className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {option.customer.name}
                  </span>
                  <span
                    className={clsx(
                      "text-sm",
                      option.customer.balance > 0 ? "text-warning-text" : "text-text-muted",
                    )}
                  >
                    {option.customer.balance > 0
                      ? `Owes ${formatTHB(option.customer.balance)}`
                      : "Owes nothing"}
                  </span>
                </>
              ) : (
                <>
                  <IconPlus size={18} aria-hidden className="shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium text-primary">
                    New customer “{option.name}”
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
