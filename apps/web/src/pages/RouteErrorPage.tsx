import { IconAlertTriangle } from "@tabler/icons-react";
import { useRouteError } from "react-router";
import { FullScreenMessage } from "@/components/layout/FullScreenMessage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Shown when a page crashes while rendering, instead of a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <FullScreenMessage>
      <EmptyState
        icon={IconAlertTriangle}
        tone="danger"
        title="Something went wrong"
        description="Reload the page to continue. If it keeps happening, tell the admin."
        action={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    </FullScreenMessage>
  );
}
