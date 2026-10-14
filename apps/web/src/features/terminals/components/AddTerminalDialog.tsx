import { TERMINAL_NAME_MAX, terminalInputSchema } from "@pos/shared";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, fieldErrorsFrom, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { useAddTerminal } from "../queries";

const FIELDS = ["code", "name"] as const;

/** "+ Add terminal" (plan.md → Settings → Terminals). Mounted only while open. */
export function AddTerminalDialog({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState({ code: "", name: "" });
  const [errors, setErrors] = useState<FieldErrors<(typeof FIELDS)[number]>>({});
  const add = useAddTerminal();

  const field = (key: (typeof FIELDS)[number]) => ({
    value: values[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = terminalInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error.issues, FIELDS));
      return focusFirstInvalid(form);
    }
    add.mutate(values, {
      onSuccess: (terminal) => {
        toast.success(`Added ${terminal.code} · ${terminal.name}`);
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

  const preview = terminalInputSchema.shape.code.safeParse(values.code);
  const generalError =
    add.isError && !apiFieldErrors(add.error, FIELDS) ? errorMessage(add.error) : null;

  return (
    <Dialog
      open
      size="sm"
      title="Add terminal"
      description="A checkout PC. Its code starts every bill number it makes."
      onClose={add.isPending ? undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={add.isPending}>
            Add terminal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          {...field("code")}
          label="Code"
          required
          autoFocus
          autoComplete="off"
          maxLength={5}
          placeholder="T2"
          hint={
            preview.success
              ? `Bills will be numbered ${preview.data}-000001, ${preview.data}-000002…`
              : "1–5 letters or numbers, starting with a letter"
          }
        />
        <TextField
          {...field("name")}
          label="Name"
          required
          autoComplete="off"
          maxLength={TERMINAL_NAME_MAX}
          placeholder="Back counter"
        />
        {generalError && <Alert tone="danger">{generalError}</Alert>}
      </div>
    </Dialog>
  );
}
