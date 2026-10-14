import {
  PASSWORD_MIN,
  ROLE_HINTS,
  ROLE_LABELS,
  USERNAME_MAX,
  userCreateSchema,
  userUpdateSchema,
  type ManagedUser,
  type Role,
} from "@pos/shared";
import { IconLock } from "@tabler/icons-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PasswordField, TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useDiscardConfirm } from "@/components/ui/useDiscardConfirm";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, fieldErrorsFrom, focusFirstInvalid, type FieldErrors } from "@/lib/forms";
import { useAddUser, useEditUser } from "../queries";

const FIELDS = ["displayName", "username", "role", "password", "confirm"] as const;
type Field = (typeof FIELDS)[number];

interface Values {
  displayName: string;
  username: string;
  role: Role;
  password: string;
  confirm: string;
}

// Cashier first: the usual choice.
const ROLE_OPTIONS = (["CASHIER", "ADMIN"] as const satisfies readonly Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

/**
 * "+ Add user" (no `user`) or Edit (plan.md → Add / Edit user dialog). Mounted only while open.
 * Passwords are set here only when adding; Reset password changes them later.
 */
export function UserFormDialog({
  user,
  isSelf = false,
  onClose,
}: {
  user?: ManagedUser;
  /** Editing yourself: the role can't be changed. */
  isSelf?: boolean;
  onClose: () => void;
}) {
  const initial: Values = {
    displayName: user?.displayName ?? "",
    username: user?.username ?? "",
    role: user?.role ?? "CASHIER",
    password: "",
    confirm: "",
  };
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const add = useAddUser();
  const edit = useEditUser(user?.id ?? "");
  const save = user ? edit : add;

  const dirty = (Object.keys(initial) as (keyof Values)[]).some(
    (key) => values[key] !== initial[key],
  );
  const { requestClose, confirm } = useDiscardConfirm({ dirty, onClose });

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const text = (key: "displayName" | "username" | "password" | "confirm") => ({
    name: key,
    value: values[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { confirm: again, password, ...profile } = values;
    const parsed = user
      ? userUpdateSchema.safeParse(profile)
      : userCreateSchema.safeParse({ ...profile, password });
    const found = parsed.success ? {} : fieldErrorsFrom(parsed.error.issues, FIELDS);
    if (!user && !found.password && password !== again) {
      found.confirm = "The two passwords don't match";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return focusFirstInvalid(form);

    // Send what was typed; the API cleans it up with the same schema.
    const handlers = {
      onSuccess: (saved: ManagedUser) => {
        toast.success(user ? `Saved ${saved.displayName}` : `Added ${saved.displayName}`);
        onClose();
      },
      onError: (error: unknown) => {
        const fieldErrors = apiFieldErrors(error, FIELDS);
        if (fieldErrors) {
          setErrors(fieldErrors);
          focusFirstInvalid(form);
        }
      },
    };
    if (user) edit.mutate(profile, handlers);
    else add.mutate({ ...profile, password }, handlers);
  };

  const generalError =
    save.isError && !apiFieldErrors(save.error, FIELDS) ? errorMessage(save.error) : null;

  return (
    <>
      <Dialog
        open
        size="md"
        title={user ? `Edit ${user.displayName}` : "Add user"}
        onClose={save.isPending ? undefined : requestClose}
        onSubmit={submit}
        footer={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {user ? "Save changes" : "Add user"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField
            {...text("displayName")}
            label="Display name"
            required
            autoFocus
            autoComplete="off"
            maxLength={60}
            hint="Shown on bills and in the sidebar"
          />
          <TextField
            {...text("username")}
            label="Username"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={USERNAME_MAX}
            hint="Used to log in. Letters, numbers, dot, dash or underscore."
          />

          <fieldset aria-invalid={errors.role ? true : undefined} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Role <span className="text-danger">*</span>
            </legend>
            {isSelf ? (
              <p className="flex items-center gap-2 text-text-soft">
                <IconLock size={18} aria-hidden />
                {ROLE_LABELS[values.role]} · You can't change your own role.
              </p>
            ) : (
              <>
                <SegmentedControl
                  label="Role"
                  value={values.role}
                  options={ROLE_OPTIONS}
                  onChange={(role) => set("role", role)}
                />
                <p className="text-sm text-text-muted">{ROLE_HINTS[values.role]}</p>
              </>
            )}
            {errors.role && <p className="text-sm text-danger">{errors.role}</p>}
          </fieldset>

          {!user && (
            <>
              <PasswordField
                {...text("password")}
                label="Password"
                required
                autoComplete="new-password"
                hint={`At least ${PASSWORD_MIN} characters`}
              />
              <PasswordField
                {...text("confirm")}
                label="Confirm password"
                required
                autoComplete="new-password"
              />
            </>
          )}
          {generalError && <Alert tone="danger">{generalError}</Alert>}
        </div>
      </Dialog>
      {confirm}
    </>
  );
}
