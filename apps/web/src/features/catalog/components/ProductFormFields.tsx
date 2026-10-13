import { formatTHB, parseThb, unitProfit, type Product } from "@pos/shared";
import { IconInfoCircle } from "@tabler/icons-react";
import { clsx } from "clsx";
import type { ChangeEvent, ReactNode, Ref } from "react";
import { TextField } from "@/components/ui/TextField";
import type { ProductField, ProductFormErrors, ProductFormValues } from "../product-form";
import { CategoryPicker } from "./CategoryPicker";
import { ItemCard } from "./ItemCard";

interface ProductFormFieldsProps {
  mode: "create" | "edit";
  values: ProductFormValues;
  errors: ProductFormErrors;
  onChange: (field: ProductField, value: string | null) => void;
  /** Edit mode: the saved product (current stock is shown read-only). */
  product?: Product;
  /** Edit mode: Restock · Adjust links next to "Current stock". */
  stockLinks?: ReactNode;
  barcodeRef?: Ref<HTMLInputElement>;
}

/** The fields shared by Add new item and Edit item, with the live item-card preview on the right. */
export function ProductFormFields({
  mode,
  values,
  errors,
  onChange,
  product,
  stockLinks,
  barcodeRef,
}: ProductFormFieldsProps) {
  const text = (field: ProductField) => ({
    name: field,
    value: values[field] ?? "",
    error: errors[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value),
  });

  const price = parseThb(values.price);
  const cost = values.cost.trim() === "" ? null : parseThb(values.cost);

  return (
    <div className="flex gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Section title="Item details">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              {...text("barcode")}
              ref={barcodeRef}
              label="Barcode"
              required
              autoFocus={mode === "create"}
              autoComplete="off"
              spellCheck={false}
            />
            <TextField
              {...text("sku")}
              label="SKU"
              autoComplete="off"
              spellCheck={false}
              placeholder="Auto if empty"
            />
          </div>
          <TextField {...text("name")} label="Item name" required autoComplete="off" />
          <CategoryPicker value={values.categoryId} onChange={(id) => onChange("categoryId", id)} />
        </Section>

        <Section title="Price">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              {...text("price")}
              label="Selling price"
              required
              unit="฿"
              inputMode="decimal"
              autoComplete="off"
            />
            <TextField
              {...text("cost")}
              label="Unit cost"
              unit="฿"
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <ProfitHint price={price} cost={cost} />
          {mode === "edit" && (
            <Note>A new price applies to new sales. Past bills keep the old price.</Note>
          )}
        </Section>

        <Section title="Stock">
          <div className="grid grid-cols-2 gap-4">
            {mode === "create" ? (
              <TextField
                {...text("startingStock")}
                label="Starting stock"
                required
                unit="pcs"
                inputMode="numeric"
                autoComplete="off"
              />
            ) : (
              <TextField
                label="Current stock"
                labelAside={stockLinks}
                value={(product?.stockQty ?? 0).toLocaleString("en-US")}
                readOnly
                unit="pcs"
              />
            )}
            <TextField
              {...text("lowStockAt")}
              label="Low-stock alert"
              unit="pcs"
              inputMode="numeric"
              autoComplete="off"
              hint={errors.lowStockAt ? undefined : "Shows “Low” at or below this"}
            />
          </div>
        </Section>
      </div>

      <aside className="w-48 shrink-0">
        <p className="mb-2 text-sm font-medium text-text-muted">Preview at checkout</p>
        <ItemCard
          product={{
            name: values.name.trim() || "Item name",
            price: price ?? 0,
            stockQty:
              mode === "create" ? Number(values.startingStock) || 0 : (product?.stockQty ?? 0),
            lowStockAt: values.lowStockAt.trim() === "" ? null : Number(values.lowStockAt) || 0,
          }}
          className="sticky top-0"
        />
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-semibold text-text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Note({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "danger" | "success";
}) {
  return (
    <p
      className={clsx(
        "-mt-2 flex items-center gap-1.5 text-sm",
        tone === "danger"
          ? "text-danger"
          : tone === "success"
            ? "text-success-text"
            : "text-text-muted",
      )}
    >
      <IconInfoCircle size={16} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

function ProfitHint({ price, cost }: { price: number | null; cost: number | null }) {
  const result = price !== null && cost !== null ? unitProfit(price, cost) : null;
  if (!result) return null;
  if (result.profit < 0) {
    return <Note tone="danger">Below cost: loses {formatTHB(-result.profit)} per item</Note>;
  }
  return (
    <Note tone="success">
      Profit {formatTHB(result.profit)} per item ({result.marginPercent}%)
    </Note>
  );
}
