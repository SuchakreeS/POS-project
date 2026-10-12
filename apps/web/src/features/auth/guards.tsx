import type { Role } from "@pos/shared";
import { IconWifiOff } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { FullScreenMessage } from "@/components/layout/FullScreenMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { NoPermissionPage } from "@/pages/NoPermissionPage";
import { useAuthStore } from "./auth-store";
import { SessionExpiredDialog } from "./SessionExpiredDialog";
import { refreshSession } from "./session";

const RETRY_MS = 3000;

/**
 * On app start, ask the API whether the refresh cookie is still good before showing any page.
 * If the API can't be reached, keep retrying instead of sending the user to the login page.
 */
export function AuthGate() {
  const status = useAuthStore((state) => state.status);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (status !== "checking") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = () => {
      refreshSession()
        .then((signedIn) => {
          if (!signedIn) useAuthStore.getState().signOut();
        })
        .catch(() => {
          if (stopped) return;
          setUnreachable(true);
          timer = setTimeout(attempt, RETRY_MS);
        });
    };

    attempt();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [status]);

  if (status !== "checking") return <Outlet />;

  return (
    <FullScreenMessage>
      {unreachable ? (
        <EmptyState
          icon={IconWifiOff}
          tone="danger"
          title="Can't reach the server"
          description="Check the internet connection. Retrying…"
        />
      ) : (
        <Spinner size={32} className="text-primary" />
      )}
    </FullScreenMessage>
  );
}

/** Pages for signed-in users. If the session ends while a page is open, the page stays and a log-in dialog opens over it. */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <>
      <Outlet />
      <SessionExpiredDialog open={status === "expired"} />
    </>
  );
}

/** Shows the "no permission" page instead of `children` when the user's role isn't allowed. */
export function RequireRole({
  roles,
  page,
  children,
}: {
  roles: readonly Role[];
  page: string;
  children: ReactNode;
}) {
  const role = useAuthStore((state) => state.user?.role);
  if (!role || !roles.includes(role)) return <NoPermissionPage page={page} />;
  return children;
}
