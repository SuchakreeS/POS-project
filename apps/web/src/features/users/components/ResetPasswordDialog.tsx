import { passwordResetSchema, PASSWORD_MIN, type ManagedUser } from "@pos/shared";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PasswordField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useLogout } from "@/features/auth/use-logout";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, fieldErrorsFrom, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { useResetPassword } from "../queries";

const FIELDS = ["password", "confirm"] as const;

/**
 * Set a new password for a user (plan.md → Users page → Reset password). They are logged out on
 * every device. Resetting your own password logs you out here too, so you log in with the new one.
 */
export function ResetPasswordDialog({
  user,
  isSelf,
  onClose,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors<(typeof FIELDS)[number]>>({});
  const reset = useResetPassword(user.id);
  const logout = useLogout();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = passwordResetSchema.safeParse({ password });
    const found = parsed.success ? {} : fieldErrorsFrom(parsed.error.issues, FIELDS);
    if (!found.password && password !== confirm) found.confirm = "The two passwords don't match";
    setErrors(found);
    if (Object.keys(found).length > 0) return focusFirstInvalid(form);

    reset.mutate(
      { password },
      {
        onSuccess: () => {
          if (isSelf) {
            toast.success("Password changed. Log in with the new one.");
            void logout();
            return;
          }
          toast.success(`New password set for ${user.displayName}`);
          onClose();
        },
        onError: (error) => {
          const fieldErrors = apiFieldErrors(error, FIELDS);
          if (fieldErrors) setErrors(fieldErrors);
        },
      },
    );
  };

  const generalError =
    reset.isError && !apiFieldErrors(reset.error, FIELDS) ? errorMessage(reset.error) : null;

  return (
    <Dialog
      open
      size="sm"
      title="Reset password"
      description={`${user.displayName} (${user.username})`}
      onClose={reset.isPending ? undefined : onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={reset.isPending}>
            Set password
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <PasswordField
          label="New password"
          required
          autoFocus
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters`}
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />
        <PasswordField
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setErrors((current) => ({ ...current, confirm: undefined }));
          }}
        />
        <Alert tone="info">
          {isSelf
            ? "You'll be logged out on every device, including this one, and log in again with the new password."
            : `${user.displayName} will be logged out on every device and must use the new password.`}
        </Alert>
        {generalError && <Alert tone="danger">{generalError}</Alert>}
      </div>
    </Dialog>
  );
}
