import { ADJUST_REASONS, adjustDelta, NOTE_MAX, type AdjustMode, type Product } from "@pos/shared";
import { IconClipboardCheck, IconMinus, IconPlus } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { ResultBox } from "@/components/ui/ResultBox";
import { SegmentedControl, type Segment } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useProduct } from "@/features/catalog/queries";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, focusFirstInvalid } from "@/lib/forms";
import { isApiError } from "@/lib/http-client";
import { useAdjustStock } from "../queries";

export interface AdjustStockDialogProps {
  /** The item to adjust; null = closed. */
  productId: string | null;
  onClose: () => void;
}

const MODES: readonly Segment<AdjustMode>[] = [
  { value: "REMOVE", label: "Remove", icon: IconMinus },
  { value: "ADD", label: "Add", icon: IconPlus },
  { value: "SET", label: "Set count", icon: IconClipboardCheck },
];

const QTY_LABELS: Record<AdjustMode, string> = {
  REMOVE: "How many to remove",
  ADD: "How many to add",
  SET: "Counted on the shelf",
};

const FIELDS = ["qty", "reason", "note"] as const;
type Field = (typeof FIELDS)[number];
type Errors = Partial<Record<Field, string>>;

/** Adjust stock (plan.md → Adjust stock dialog). Standalone: takes an id, loads and saves its own data. */
export function AdjustStockDialog({ productId, onClose }: AdjustStockDialogProps) {
  const { data: product, error } = useProduct(productId);
  if (!productId) return null;

  if (!product) {
    return (
      <Dialog open size="md" title="Adjust stock" onClose={onClose}>
        {error ? (
          <Alert tone="danger">{errorMessage(error)}</Alert>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
      </Dialog>
    );
  }
  return <AdjustForm key={productId} product={product} onClose={onClose} />;
}

function AdjustForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const adjust = useAdjustStock();
  const [mode, setMode] = useState<AdjustMode>("REMOVE");
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const qty = /^\d+$/.test(qtyText.trim()) ? Number(qtyText.trim()) : null;
  const delta = qty === null ? null : adjustDelta(mode, qty, product.stockQty);
  const after = delta === null ? null : product.stockQty + delta;
  const reasons: readonly string[] = ADJUST_REASONS[mode];

  const changeMode = (next: AdjustMode) => {
    setMode(next);
    setReason(next === "SET" ? "Count correction" : null);
    setErrors({});
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (qty === null) found.qty = "Enter a whole number, like 3";
    else if (mode !== "SET" && qty < 1) found.qty = "Quantity must be at least 1";
    else if (delta === 0) found.qty = `Stock is already ${product.stockQty}. Nothing to change.`;
    if (!reason) found.reason = "Pick a reason";
    if (reason === "Other" && !note.trim()) found.note = "Say what happened";
    return found;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || qty === null || !reason) return focusFirstInvalid(form);

    adjust.mutate(
      { productId: product.id, mode, qty, reason, note },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.name}: stock is now ${saved.stockQty.toLocaleString("en-US")}`);
          onClose();
        },
        onError: (failure) => {
          const fieldErrors = apiFieldErrors(failure, FIELDS);
          if (fieldErrors) {
            setErrors(fieldErrors);
            focusFirstInvalid(form);
          }
        },
      },
    );
  };

  const confirmLabel =
    qty === null
      ? MODES.find((m) => m.value === mode)?.label
      : mode === "REMOVE"
        ? `Remove ${qty} pcs`
        : mode === "ADD"
          ? `Add ${qty} pcs`
          : `Set stock to ${qty}`;

  const generalError =
    adjust.isError && !(isApiError(adjust.error) && adjust.error.issues?.length)
      ? errorMessage(adjust.error)
      : null;

  return (
    <Dialog
      open
      size="md"
      title="Adjust stock"
      description={[
        product.name,
        product.sku,
        `Stock ${product.stockQty.toLocaleString("en-US")} pcs`,
      ]
        .filter(Boolean)
        .join(" · ")}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={adjust.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={adjust.isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl label="What to do" value={mode} options={MODES} onChange={changeMode} />

        <TextField
          key={mode}
          label={QTY_LABELS[mode]}
          required
          autoFocus
          unit="pcs"
          inputMode="numeric"
          autoComplete="off"
          value={qtyText}
          error={errors.qty}
          hint={mode === "ADD" ? "For a new delivery, use Restock instead." : undefined}
          onChange={(event) => {
            setQtyText(event.target.value);
            setErrors((current) => ({ ...current, qty: undefined }));
          }}
        />

        {mode !== "SET" && (
          <fieldset aria-invalid={errors.reason ? true : undefined} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Reason <span className="text-danger">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {reasons.map((option) => (
                <Chip
                  key={option}
                  selected={reason === option}
                  onClick={() => {
                    setReason(option);
                    setErrors((current) => ({ ...current, reason: undefined }));
                  }}
                >
                  {option}
                </Chip>
              ))}
            </div>
            {errors.reason && <p className="text-sm text-danger">{errors.reason}</p>}
          </fieldset>
        )}

        <TextField
          label={reason === "Other" ? "Note" : "Note (optional)"}
          required={reason === "Other"}
          maxLength={NOTE_MAX}
          placeholder={mode === "SET" ? "e.g. Monthly count" : "What happened?"}
          value={note}
          error={errors.note}
          onChange={(event) => {
            setNote(event.target.value);
            setErrors((current) => ({ ...current, note: undefined }));
          }}
        />

        {after !== null && delta !== null && delta !== 0 && (
          <ResultBox label={mode === "SET" ? `Difference ${signed(delta)} pcs` : "Stock"}>
            <span className="font-normal text-text-muted">
              {product.stockQty.toLocaleString("en-US")} →{" "}
            </span>
            {after.toLocaleString("en-US")} pcs
          </ResultBox>
        )}
        {after !== null && after < 0 && (
          <Alert tone="warning">Stock will go below 0. Check the count later.</Alert>
        )}
        {generalError && <Alert tone="danger">{generalError}</Alert>}
      </div>
    </Dialog>
  );
}

function signed(n: number) {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}
