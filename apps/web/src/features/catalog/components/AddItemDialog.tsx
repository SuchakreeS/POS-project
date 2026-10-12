import type { Product } from "@pos/shared";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { toast } from "@/components/ui/toast";
import { useDiscardConfirm } from "@/components/ui/useDiscardConfirm";
import { useShopSettings } from "@/features/settings/queries";
import { errorMessage } from "@/lib/errors";
import { focusFirstInvalid } from "@/lib/forms";
import {
  emptyProductForm,
  isDirty,
  parseProductForm,
  serverFieldErrors,
  type ProductField,
  type ProductFormErrors,
} from "../product-form";
import { useCreateProduct } from "../queries";
import { ProductFormFields } from "./ProductFormFields";

export interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the barcode (from an unknown scan). */
  initialBarcode?: string;
  /** Called after each save (Restock uses it to add the new item to its list). */
  onSaved?: (product: Product) => void;
}

/** Add new item (plan.md → Add new item modal). Standalone: loads and saves its own data. */
export function AddItemDialog(props: AddItemDialogProps) {
  // Mounted only while open, so every opening starts with a fresh form.
  return props.open ? <AddItemForm {...props} /> : null;
}

function AddItemForm({ onClose, initialBarcode, onSaved }: AddItemDialogProps) {
  const { data: settings } = useShopSettings();
  const defaults = { barcode: initialBarcode, lowStockAt: settings?.defaultLowStockAt ?? 5 };
  const [initial, setInitial] = useState(() => emptyProductForm(defaults));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [addAnother, setAddAnother] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const create = useCreateProduct();
  const discard = useDiscardConfirm({
    dirty: isDirty(values, initial),
    onClose,
    title: "Discard this item?",
    description: "It hasn't been saved yet.",
  });

  const change = (field: ProductField, value: string | null) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const another =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "another";
    const parsed = parseProductForm(values, "create");
    if (!parsed.ok) {
      setErrors(parsed.errors);
      focusFirstInvalid(form);
      return;
    }
    setAddAnother(another);
    create.mutate(parsed.data, {
      onSuccess: (product) => {
        toast.success(`Added ${product.name}`);
        onSaved?.(product);
        if (!another) return onClose();

        // Keep the category and alert level for the next item from the same delivery.
        const next = emptyProductForm({
          categoryId: values.categoryId,
          lowStockAt: Number(values.lowStockAt) || null,
        });
        setInitial(next);
        setValues(next);
        create.reset();
        barcodeRef.current?.focus();
      },
      onError: (error) => {
        const fieldErrors = serverFieldErrors(error);
        if (fieldErrors) {
          setErrors(fieldErrors);
          focusFirstInvalid(form);
        }
      },
    });
  };

  const generalError =
    create.isError && !serverFieldErrors(create.error) ? errorMessage(create.error) : null;

  return (
    <>
      <Dialog
        open
        size="xl"
        title="Add new item"
        description="Scan the barcode first, then fill in the rest."
        onClose={discard.requestClose}
        onSubmit={submit}
        footer={
          <>
            <Button variant="ghost" onClick={discard.requestClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              value="another"
              loading={create.isPending && addAnother}
              disabled={create.isPending}
            >
              Save and add another
            </Button>
            <Button
              type="submit"
              value="close"
              loading={create.isPending && !addAnother}
              disabled={create.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <ProductFormFields
          mode="create"
          values={values}
          errors={errors}
          onChange={change}
          barcodeRef={barcodeRef}
        />
        {generalError && (
          <Alert tone="danger" className="mt-5">
            {generalError}
          </Alert>
        )}
      </Dialog>
      {discard.confirm}
    </>
  );
}
