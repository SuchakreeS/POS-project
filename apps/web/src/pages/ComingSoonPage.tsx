import { IconTools } from "@tabler/icons-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Placeholder for pages built in later steps (plan.md → Build order). */
export function ComingSoonPage({ title, step }: { title: string; step: number }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={IconTools}
        title="Not built yet"
        description={`This page comes in build step ${step}.`}
      />
    </>
  );
}
