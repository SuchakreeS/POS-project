import { loginInputSchema, type LoginInput } from "@pos/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useLocation, type Location } from "react-router";
import { HOME_PATH } from "@/app/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/TextField";
import { login } from "@/features/auth/auth-api";
import { useAuthStore } from "@/features/auth/auth-store";
import { errorMessage } from "@/lib/errors";

type FieldErrors = Partial<Record<keyof LoginInput, string>>;

/** Login (plan.md → Login page). Decorative circles appear on this page only. */
export function LoginPage() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  const [form, setForm] = useState<LoginInput>({ username: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const signIn = useMutation({ mutationFn: login });

  if (status === "signedIn") {
    return <Navigate to={redirectTarget(location)} replace />;
  }

  const update = (field: keyof LoginInput) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = loginInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginInput;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      focusField(event.currentTarget, Object.keys(errors)[0]);
      return;
    }
    signIn.mutate(parsed.data); // on success the store changes and the redirect above runs
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page p-6">
      <DecorativeCircles />

      <main className="relative w-full max-w-md rounded-3xl border-2 border-border bg-page p-8">
        <p className="text-2xl font-semibold text-primary">POS</p>
        <h1 className="mt-4 text-2xl font-semibold">Welcome</h1>
        <p className="text-text-muted">Log in to start selling.</p>

        <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={form.username}
            error={fieldErrors.username}
            onChange={update("username")}
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            error={fieldErrors.password}
            onChange={update("password")}
          />

          <Button type="submit" size="lg" fullWidth loading={signIn.isPending} className="mt-2">
            Log in
          </Button>

          {signIn.isError && <Alert tone="danger">{errorMessage(signIn.error)}</Alert>}
        </form>
      </main>
    </div>
  );
}

function focusField(form: HTMLFormElement, name: string | undefined) {
  const field = name ? form.elements.namedItem(name) : null;
  if (field instanceof HTMLInputElement) field.focus();
}

/** Back to the page the user tried to open before being sent to login. */
function redirectTarget(location: Location): string {
  const from = (location.state as { from?: Location } | null)?.from;
  if (!from || from.pathname === "/login") return HOME_PATH;
  return `${from.pathname}${from.search}${from.hash}`;
}

function DecorativeCircles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-[#0f1f4d]" />
      <div className="absolute -top-20 -right-24 size-72 rounded-full bg-primary-dark" />
      <div className="absolute -bottom-40 -left-20 size-96 rounded-full bg-primary" />
      <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-warning" />
    </div>
  );
}
