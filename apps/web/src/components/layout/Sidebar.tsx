import { NavContent } from "./NavContent";

/** Fixed nav on the right of every page except checkout (plan.md → App frame). */
export function Sidebar() {
  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-l-2 border-border bg-page">
      <NavContent />
    </aside>
  );
}
