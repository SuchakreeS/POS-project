import { CATEGORY_NAME_MAX, categoryNameSchema, type Category } from "@pos/shared";
import { IconCheck, IconChevronDown, IconPlus } from "@tabler/icons-react";
import { clsx } from "clsx";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/errors";
import { useCategories, useCreateCategory } from "../queries";

interface CategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
}

type Option = { kind: "none" } | { kind: "category"; category: Category } | { kind: "new" };

/**
 * Searchable category dropdown with "+ New category" at the bottom (plan.md → Add new item).
 * Creating a category selects it and keeps the rest of the form as typed.
 */
export function CategoryPicker({ value, onChange, label = "Category" }: CategoryPickerProps) {
  const labelId = useId();
  const listId = useId();
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);

  const selected = categories.find((category) => category.id === value);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = categories
      .filter((category) => category.name.toLowerCase().includes(q))
      .map((category): Option => ({ kind: "category", category }));
    return [...(q ? [] : [{ kind: "none" } as Option]), ...matches, { kind: "new" }];
  }, [categories, query]);

  const openChange = (next: boolean) => {
    setOpen(next);
    setQuery("");
    setActive(0);
    setCreating(null);
  };

  const choose = (option: Option) => {
    if (option.kind === "new") {
      setCreating(query.trim()); // prefill with what was typed in the search
      return;
    }
    onChange(option.kind === "category" ? option.category.id : null);
    openChange(false);
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    }
  };

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-text">
        {label}
      </span>
      <Popover.Root open={open} onOpenChange={openChange}>
        <Popover.Trigger
          aria-labelledby={labelId}
          className={clsx(
            "flex h-10 w-full items-center justify-between gap-2 rounded-full border-2 bg-surface-alt pr-3 pl-4 text-left text-base transition-colors",
            "focus-visible:border-primary focus-visible:bg-page focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none",
            open ? "border-primary bg-page" : "border-border",
          )}
        >
          <span className={clsx("truncate", !selected && "text-placeholder")}>
            {selected?.name ?? "No category"}
          </span>
          <IconChevronDown size={18} aria-hidden className="shrink-0 text-text-soft" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-2xl border-2 border-border bg-page p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
          >
            {creating === null ? (
              <>
                <input
                  autoFocus
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={optionId(active)}
                  aria-label="Search categories"
                  placeholder="Search categories"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKey}
                  className="mb-1 h-9 w-full rounded-full border-2 border-border bg-surface-alt px-3 text-sm focus:border-primary focus:bg-page focus:outline-none"
                />
                <ul
                  id={listId}
                  role="listbox"
                  aria-labelledby={labelId}
                  className="max-h-60 overflow-y-auto"
                >
                  {options.map((option, index) => (
                    <li
                      key={option.kind === "category" ? option.category.id : option.kind}
                      id={optionId(index)}
                      role="option"
                      aria-selected={
                        option.kind === "category"
                          ? option.category.id === value
                          : option.kind === "none" && !value
                      }
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()} // keep focus in the search box
                      onClick={() => choose(option)}
                      className={clsx(
                        "flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm",
                        index === active && "bg-hover",
                        option.kind === "new" && "mt-1 font-medium text-primary",
                        option.kind === "none" && "text-text-muted",
                      )}
                    >
                      {option.kind === "new" && <IconPlus size={16} aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">
                        {option.kind === "category"
                          ? option.category.name
                          : option.kind === "none"
                            ? "No category"
                            : "New category"}
                      </span>
                      {option.kind === "category" && option.category.id === value && (
                        <IconCheck size={16} aria-hidden className="text-primary" />
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <NewCategoryForm
                initialName={creating}
                onCancel={() => setCreating(null)}
                onCreated={(category) => {
                  onChange(category.id);
                  openChange(false);
                }}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function NewCategoryForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (category: Category) => void;
}) {
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const create = useCreateCategory();
  const inputRef = useRef<HTMLInputElement>(null);

  // Not a <form>: this sits inside the item form, and nested forms aren't allowed.
  const submit = () => {
    const parsed = categoryNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      inputRef.current?.focus();
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: onCreated,
      onError: (failure) => setError(errorMessage(failure)),
    });
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        New category
      </label>
      <input
        id={inputId}
        ref={inputRef}
        autoFocus
        maxLength={CATEGORY_NAME_MAX}
        value={name}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className={clsx(
          "h-9 w-full rounded-full border-2 bg-page px-3 text-sm focus:outline-none",
          error ? "border-danger" : "border-primary",
        )}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={create.isPending}>
          Back
        </Button>
        <Button size="sm" onClick={submit} loading={create.isPending}>
          Add
        </Button>
      </div>
    </div>
  );
}
