import { Outlet } from "react-router";
import { BillViewer } from "@/features/orders/components/BillViewer";
import { Sidebar } from "./Sidebar";

/** Page content on the left, fixed sidebar on the right (plan.md → App frame). */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <Outlet />
      </main>
      <Sidebar />
      <BillViewer />
    </div>
  );
}
