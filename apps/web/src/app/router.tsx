import { createBrowserRouter, Navigate, Outlet, type RouteObject } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGate, RequireAuth, RequireRole } from "@/features/auth/guards";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteErrorPage } from "@/pages/RouteErrorPage";
import { SetupCheckPage } from "@/pages/SetupCheckPage";
import { HOME_PATH } from "./navigation";

const ADMIN_ONLY = ["ADMIN"] as const;

/** An admin-only page: cashiers see "Only admins can open …" (the API returns 403 as well). */
function adminPage(path: string, page: string, load: RouteObject["lazy"]): RouteObject {
  return {
    path,
    element: (
      <RequireRole roles={ADMIN_ONLY} page={page}>
        <Outlet />
      </RequireRole>
    ),
    children: [{ index: true, lazy: load }],
  };
}

// Feature pages load on first visit (`lazy`), so the login screen stays small and fast.

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorPage />,
    children: [
      { path: "setup", element: <SetupCheckPage /> },
      {
        element: <AuthGate />,
        children: [
          { path: "login", element: <LoginPage /> },
          {
            element: <RequireAuth />,
            children: [
              // Checkout has its own full-screen layout: cart on the right, nav in a slide-in drawer.
              {
                path: "checkout",
                lazy: () =>
                  import("@/pages/CheckoutPage").then((m) => ({ Component: m.CheckoutPage })),
              },
              {
                element: <AppLayout />,
                children: [
                  { index: true, element: <Navigate to={HOME_PATH} replace /> },
                  {
                    path: "stock",
                    lazy: () =>
                      import("@/pages/StockPage").then((m) => ({ Component: m.StockPage })),
                  },
                  {
                    path: "promptpay",
                    lazy: () =>
                      import("@/pages/PromptPayPage").then((m) => ({ Component: m.PromptPayPage })),
                  },
                  {
                    path: "credit",
                    lazy: () =>
                      import("@/pages/CreditPage").then((m) => ({ Component: m.CreditPage })),
                  },
                  {
                    path: "orders",
                    lazy: () =>
                      import("@/pages/OrdersPage").then((m) => ({ Component: m.OrdersPage })),
                  },
                  { path: "reports", element: <ComingSoonPage title="Reports" step={11} /> },
                  adminPage("users", "Users", () =>
                    import("@/pages/UsersPage").then((m) => ({ Component: m.UsersPage })),
                  ),
                  adminPage("settings", "Settings", () =>
                    import("@/pages/SettingsPage").then((m) => ({ Component: m.SettingsPage })),
                  ),
                  { path: "*", element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
