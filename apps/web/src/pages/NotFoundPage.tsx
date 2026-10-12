import { IconCompass } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { BackHomeLink } from "./NoPermissionPage";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={IconCompass}
      title="Page not found"
      description="The link may be old or mistyped."
      action={<BackHomeLink />}
      className="mt-16"
    />
  );
}
