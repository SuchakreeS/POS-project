import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGate, RequireAuth, RequireRole } from "@/features/auth/guards";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RouteErrorPage } from "@/pages/RouteErrorPage";
import { SetupCheckPage } from "@/pages/SetupCheckPage";
import { HOME_PATH } from "./navigation";

const ADMIN_ONLY = ["ADMIN"] as const;

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
              {
                element: <AppLayout />,
                children: [
                  { index: true, element: <Navigate to={HOME_PATH} replace /> },
                  { path: "checkout", element: <ComingSoonPage title="Checkout" step={6} /> },
                  {
                    path: "stock",
                    lazy: () =>
                      import("@/pages/StockPage").then((m) => ({ Component: m.StockPage })),
                  },
                  { path: "promptpay", element: <ComingSoonPage title="PromptPay" step={7} /> },
                  { path: "credit", element: <ComingSoonPage title="Credit" step={8} /> },
                  { path: "orders", element: <ComingSoonPage title="Orders" step={9} /> },
                  { path: "reports", element: <ComingSoonPage title="Reports" step={11} /> },
                  {
                    path: "users",
                    element: (
                      <RequireRole roles={ADMIN_ONLY} page="Users">
                        <ComingSoonPage title="Users" step={10} />
                      </RequireRole>
                    ),
                  },
                  {
                    path: "settings",
                    element: (
                      <RequireRole roles={ADMIN_ONLY} page="Settings">
                        <ComingSoonPage title="Settings" step={10} />
                      </RequireRole>
                    ),
                  },
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
