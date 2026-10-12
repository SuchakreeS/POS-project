import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PasswordField } from "@/components/ui/TextField";
import { errorMessage } from "@/lib/errors";
import { login } from "./auth-api";
import { useAuthStore } from "./auth-store";
import { useLogout } from "./use-logout";

/**
 * "Please log in again" over the current page (plan.md → Session expired).
 * Logging back in as the same user keeps the page and its unsaved work as they were.
 */
export function SessionExpiredDialog({ open }: { open: boolean }) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();

  const relogin = useMutation({
    mutationFn: login,
    onSuccess: () => {
      setPassword("");
      // Anything that failed while logged out loads again.
      void queryClient.invalidateQueries();
    },
  });

  if (!user) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setPasswordError("Enter your password");
      return;
    }
    setPasswordError(undefined);
    relogin.mutate({ username: user.username, password });
  };

  return (
    <Dialog
      open={open}
      size="sm"
      title="Please log in again"
      description="You were logged out for security. Your work on this page is still here."
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={logout} disabled={relogin.isPending}>
            Switch user
          </Button>
          <Button type="submit" loading={relogin.isPending}>
            Log in
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>
          Logged in as <span className="font-semibold">{user.displayName}</span>{" "}
          <span className="text-text-muted">({user.username})</span>
        </p>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          error={passwordError}
          onChange={(event) => setPassword(event.target.value)}
        />
        {relogin.isError && <Alert tone="danger">{errorMessage(relogin.error)}</Alert>}
      </div>
    </Dialog>
  );
}
