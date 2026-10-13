import { NOTE_MAX, stockStatus, type Product } from "@pos/shared";
import { IconPackages, IconX } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useDiscardConfirm } from "@/components/ui/useDiscardConfirm";
import { AddItemDialog } from "@/features/catalog/components/AddItemDialog";
import { ProductSearchBox, type PickSource } from "@/features/catalog/components/ProductSearchBox";
import { useProducts } from "@/features/catalog/queries";
import { errorMessage } from "@/lib/errors";
import { useRestock } from "../queries";
import {
  addToList,
  emptyRestockList,
  parseQty,
  removeFromList,
  setQty,
  summarize,
  toRestockInput,
  type RestockList,
} from "../restock-list";

export interface RestockDialogProps {
  open: boolean;
  onClose: () => void;
  /** Row "Restock": start with this item in the list. */
  initialProductId?: string | null;
}

/** Restock a delivery (plan.md → Restock modal). Standalone: loads and saves its own data. */
export function RestockDialog(props: RestockDialogProps) {
  return props.open ? <RestockForm {...props} /> : null;
}

function RestockForm({ onClose, initialProductId }: RestockDialogProps) {
  const { data: products = [] } = useProducts();
  const restock = useRestock();
  const [list, setList] = useState<RestockList>(() => {
    const initial = products.find((product) => product.id === initialProductId);
    return initial ? addToList(emptyRestockList, initial) : emptyRestockList;
  });
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [addingBarcode, setAddingBarcode] = useState<string | null>(null);
  /** Row whose quantity box gets focus once the list has re-rendered. */
  const focusQtyOf = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());

  const summary = summarize(list);
  const discard = useDiscardConfirm({
    dirty: list.rows.length > 0,
    onClose,
    title: "Discard this restock?",
    description: "The items in the list won't be added to stock.",
  });

  // Picked by name or from Add new item → type the quantity next. Scanned → stay in the scan box.
  useEffect(() => {
    if (!focusQtyOf.current) return;
    const input = qtyRefs.current.get(focusQtyOf.current);
    focusQtyOf.current = null;
    input?.focus();
  }, [list]);

  const add = (product: Product, source: PickSource) => {
    setList((current) => addToList(current, product));
    if (source === "search") focusQtyOf.current = product.id;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!summary.valid) {
      setShowErrors(true);
      const firstBad = list.rows.find((row) => parseQty(row.qty) === null);
      if (firstBad) qtyRefs.current.get(firstBad.product.id)?.focus();
      return;
    }
    restock.mutate(toRestockInput(list, note), {
      onSuccess: () => {
        toast.success(`Restocked ${plural(summary.products, "item")}`);
        onClose();
      },
    });
  };

  return (
    <>
      <Dialog
        open
        size="lg"
        title="Restock"
        description="Scan each product as you unpack the delivery."
        onClose={discard.requestClose}
        onSubmit={submit}
        footer={
          <>
            <span className="mr-auto text-text-muted">
              {plural(summary.products, "product")} · {summary.pieces.toLocaleString("en-US")} pcs
            </span>
            <Button variant="ghost" onClick={discard.requestClose} disabled={restock.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={restock.isPending} disabled={list.rows.length === 0}>
              Restock {plural(summary.products, "item")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <ProductSearchBox
            products={products}
            onPick={add}
            onAddNew={setAddingBarcode}
            inputRef={searchRef}
            autoFocus={!initialProductId}
          />

          {list.rows.length === 0 ? (
            <EmptyState
              icon={IconPackages}
              title="Scan the first item"
              description="Or type its name and press Enter."
              className="py-6"
            />
          ) : (
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col />
                <col className="w-16" />
                <col className="w-28" />
                <col className="w-16" />
                <col className="w-11" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-border text-left text-sm text-text-muted">
                  <th scope="col" className="px-2 py-2 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Now
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Add
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    New
                  </th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map(({ product, qty }) => {
                  const add = parseQty(qty);
                  const invalid = showErrors && add === null;
                  return (
                    <tr
                      key={product.id}
                      className={clsx(
                        "border-b-2 border-border",
                        product.id === list.lastId && "bg-primary-tint",
                      )}
                    >
                      <td className="truncate px-2 py-2 font-medium" title={product.name}>
                        {product.name}
                      </td>
                      <td className={clsx("px-2 text-right", NOW_COLORS[stockStatus(product)])}>
                        {product.stockQty.toLocaleString("en-US")}
                      </td>
                      <td className="px-2">
                        <input
                          ref={(element) => {
                            if (element) qtyRefs.current.set(product.id, element);
                            else qtyRefs.current.delete(product.id);
                          }}
                          aria-label={`Quantity to add for ${product.name}`}
                          aria-invalid={invalid || undefined}
                          inputMode="numeric"
                          // Row "Restock" opens with this item: start on its quantity.
                          autoFocus={product.id === initialProductId}
                          // Typing replaces the number instead of adding to it.
                          onFocus={(event) => event.currentTarget.select()}
                          value={qty}
                          onChange={(event) =>
                            setList((current) => setQty(current, product.id, event.target.value))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault(); // Enter = back to scanning, not "save"
                              searchRef.current?.focus();
                            }
                          }}
                          className={clsx(
                            "h-9 w-full rounded-full border-2 bg-page px-3 text-right focus:ring-1 focus:outline-none",
                            invalid
                              ? "border-danger focus:ring-danger"
                              : "border-border focus:border-primary focus:ring-primary",
                          )}
                        />
                      </td>
                      <td className="px-2 text-right font-semibold">
                        {add === null ? "—" : (product.stockQty + add).toLocaleString("en-US")}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          aria-label={`Remove ${product.name}`}
                          onClick={() => setList((current) => removeFromList(current, product.id))}
                          className="inline-flex size-8 items-center justify-center rounded-full text-text-muted hover:bg-hover hover:text-danger focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                        >
                          <IconX size={18} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {showErrors && !summary.valid && list.rows.length > 0 && (
            <Alert tone="danger">
              Each quantity must be a whole number from 1. Use Adjust stock to take stock away.
            </Alert>
          )}

          <TextField
            label="Note (optional)"
            placeholder="Supplier or invoice number"
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />

          {restock.isError && <Alert tone="danger">{errorMessage(restock.error)}</Alert>}
        </div>
      </Dialog>

      {discard.confirm}

      <AddItemDialog
        open={addingBarcode !== null}
        initialBarcode={addingBarcode ?? undefined}
        onClose={() => {
          setAddingBarcode(null);
          searchRef.current?.focus();
        }}
        onSaved={(product) => {
          setList((current) => addToList(current, product));
          focusQtyOf.current = product.id;
        }}
      />
    </>
  );
}

const NOW_COLORS = {
  OUT: "font-semibold text-danger",
  LOW: "font-semibold text-warning-text",
  OK: "",
} as const;

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}
