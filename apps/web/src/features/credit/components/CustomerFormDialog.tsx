import {
  CUSTOMER_NAME_MAX,
  NOTE_MAX,
  customerInputSchema,
  PHONE_MAX,
  type CustomerSummary,
} from "@pos/shared";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, fieldErrorsFrom, focusFirstInvalid } from "@/lib/forms";
import { useSaveCustomer } from "../queries";

const FIELDS = ["name", "phone", "note"] as const;
type Field = (typeof FIELDS)[number];

export interface CustomerFormValues {
  name: string;
  phone: string;
  note: string;
}

/** "+ Add customer" (no `customer`) or Edit (with one). Mounted only while open. */
export function CustomerFormDialog({
  open,
  customer,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Editing: the customer's id. */
  customer?: { id: string } | null;
  initial?: CustomerFormValues;
  onClose: () => void;
  onSaved?: (customer: CustomerSummary) => void;
}) {
  if (!open) return null;
  return (
    <CustomerForm id={customer?.id ?? null} initial={initial} onClose={onClose} onSaved={onSaved} />
  );
}

function CustomerForm({
  id,
  initial,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial?: CustomerFormValues;
  onClose: () => void;
  onSaved?: (customer: CustomerSummary) => void;
}) {
  const [values, setValues] = useState<CustomerFormValues>(
    initial ?? { name: "", phone: "", note: "" },
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const save = useSaveCustomer(id);

  const field = (name: Field) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [name]: event.target.value }));
      setErrors((current) => ({ ...current, [name]: undefined }));
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = customerInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error.issues, FIELDS));
      return focusFirstInvalid(form);
    }
    save.mutate(parsed.data, {
      onSuccess: (saved) => {
        toast.success(id ? `Saved ${saved.name}` : `Added ${saved.name}`);
        onSaved?.(saved);
        onClose();
      },
      onError: (error) => {
        const fieldErrors = apiFieldErrors(error, FIELDS);
        if (fieldErrors) {
          setErrors(fieldErrors);
          focusFirstInvalid(form);
        }
      },
    });
  };

  const generalError =
    save.isError && !apiFieldErrors(save.error, FIELDS) ? errorMessage(save.error) : null;

  return (
    <Dialog
      open
      size="md"
      title={id ? "Edit customer" : "Add customer"}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {id ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          {...field("name")}
          label="Name"
          required
          autoFocus
          autoComplete="off"
          maxLength={CUSTOMER_NAME_MAX}
        />
        <TextField
          {...field("phone")}
          label="Phone (optional)"
          inputMode="tel"
          autoComplete="off"
          maxLength={PHONE_MAX}
        />
        <TextField
          {...field("note")}
          label="Note (optional)"
          autoComplete="off"
          maxLength={NOTE_MAX}
          placeholder="e.g. Pays on Fridays"
        />
        {generalError && <Alert tone="danger">{generalError}</Alert>}
      </div>
    </Dialog>
  );
}
