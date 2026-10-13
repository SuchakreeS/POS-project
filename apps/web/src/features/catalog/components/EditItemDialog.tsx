import type { Product } from "@pos/shared";
import { IconEyeOff, IconPower } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { LinkButton } from "@/components/ui/LinkButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { useDiscardConfirm } from "@/components/ui/useDiscardConfirm";
import { errorMessage } from "@/lib/errors";
import { focusFirstInvalid } from "@/lib/forms";
import {
  changedFields,
  isDirty,
  parseProductForm,
  productToForm,
  serverFieldErrors,
  type ProductField,
  type ProductFormErrors,
} from "../product-form";
import { useProduct, useUpdateProduct } from "../queries";
import { DeactivateItemDialog } from "./DeactivateItemDialog";
import { ProductFormFields } from "./ProductFormFields";

export interface EditItemDialogProps {
  /** The item to edit; null = closed. */
  productId: string | null;
  onClose: () => void;
  /** Show Restock · Adjust links by "Current stock"; the dialog closes (asking first if edited), then these run. */
  onRestock?: (productId: string) => void;
  onAdjust?: (productId: string) => void;
}

/** Edit item (plan.md → Edit item dialog). Standalone: takes an id, loads and saves its own data. */
export function EditItemDialog({ productId, onClose, onRestock, onAdjust }: EditItemDialogProps) {
  const query = useProduct(productId);
  if (!productId) return null;

  if (!query.data) {
    return (
      <Dialog open size="xl" title="Edit item" onClose={onClose}>
        {query.isError ? (
          <Alert tone="danger">{errorMessage(query.error)}</Alert>
        ) : (
          <div className="flex flex-col gap-4" aria-busy>
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        )}
      </Dialog>
    );
  }

  // Keyed by id so switching items starts a fresh form.
  return (
    <EditItemForm
      key={productId}
      product={query.data}
      onClose={onClose}
      onRestock={onRestock}
      onAdjust={onAdjust}
    />
  );
}

function EditItemForm({
  product,
  onClose,
  onRestock,
  onAdjust,
}: { product: Product } & Omit<EditItemDialogProps, "productId">) {
  const [initial] = useState(() => productToForm(product));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const update = useUpdateProduct(product.id);
  const discard = useDiscardConfirm({ dirty: isDirty(values, initial), onClose });

  const change = (field: ProductField, value: string | null) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = parseProductForm(values, "edit");
    if (!parsed.ok) {
      setErrors(parsed.errors);
      focusFirstInvalid(form);
      return;
    }
    const changes = changedFields(product, parsed.data);
    if (Object.keys(changes).length === 0) return onClose();

    update.mutate(changes, {
      onSuccess: (saved) => {
        toast.success(`Saved ${saved.name}`);
        onClose();
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
    update.isError && !serverFieldErrors(update.error) ? errorMessage(update.error) : null;
  const StatusIcon = product.isActive ? IconEyeOff : IconPower;

  return (
    <>
      <Dialog
        open
        size="xl"
        title="Edit item"
        description={[product.name, product.sku].filter(Boolean).join(" · ")}
        onClose={discard.requestClose}
        onSubmit={submit}
        footer={
          <>
            <Button
              variant={product.isActive ? "danger" : "ghost"}
              icon={<StatusIcon size={18} aria-hidden />}
              className="mr-auto -ml-3"
              onClick={() => setConfirmingStatus(true)}
              disabled={update.isPending}
            >
              {product.isActive ? "Deactivate item" : "Turn back on"}
            </Button>
            <Button variant="ghost" onClick={discard.requestClose} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={update.isPending}>
              Save changes
            </Button>
          </>
        }
      >
        {!product.isActive && (
          <Alert tone="warning" className="mb-5">
            This item is turned off, so it doesn't show at checkout.
          </Alert>
        )}
        <ProductFormFields
          mode="edit"
          product={product}
          stockLinks={
            (onRestock || onAdjust) && (
              <span className="flex gap-3 text-sm">
                {onRestock && (
                  <LinkButton onClick={() => discard.closeThen(() => onRestock(product.id))}>
                    Restock
                  </LinkButton>
                )}
                {onAdjust && (
                  <LinkButton onClick={() => discard.closeThen(() => onAdjust(product.id))}>
                    Adjust
                  </LinkButton>
                )}
              </span>
            )
          }
          values={values}
          errors={errors}
          onChange={change}
        />
        {generalError && (
          <Alert tone="danger" className="mt-5">
            {generalError}
          </Alert>
        )}
      </Dialog>
      {discard.confirm}
      <DeactivateItemDialog
        product={confirmingStatus ? product : null}
        onClose={() => setConfirmingStatus(false)}
        onDone={onClose}
      />
    </>
  );
}
