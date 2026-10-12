import { IconLock } from "@tabler/icons-react";
import { Link } from "react-router";
import { HOME_PATH } from "@/app/navigation";
import { EmptyState } from "@/components/ui/EmptyState";

/** A cashier opened an admin page (plan.md → No permission). The API also answers 403. */
export function NoPermissionPage({ page }: { page: string }) {
  return (
    <EmptyState
      icon={IconLock}
      title={`Only admins can open ${page}`}
      description="Ask an admin if you need something changed here."
      action={<BackHomeLink />}
      className="mt-16"
    />
  );
}

export function BackHomeLink() {
  return (
    <Link
      to={HOME_PATH}
      className="inline-flex h-10 items-center rounded-full border-2 border-border-strong px-5 font-medium hover:bg-hover focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none"
    >
      Back to Checkout
    </Link>
  );
}
