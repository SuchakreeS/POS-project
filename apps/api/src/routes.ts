import type { Express } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { creditRouter } from "./modules/credit/credit.routes";
import { healthRouter } from "./modules/health/health.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { productsRouter } from "./modules/products/products.routes";
import { promptpayRouter } from "./modules/promptpay/promptpay.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { terminalsRouter } from "./modules/terminals/terminals.routes";
import { usersRouter } from "./modules/users/users.routes";

/** Every feature router is mounted here — one place to see the whole API. */
export function registerRoutes(app: Express) {
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/categories", categoriesRouter);
  app.use("/products", productsRouter);
  app.use("/inventory", inventoryRouter);
  app.use("/orders", ordersRouter);
  app.use("/promptpay", promptpayRouter);
  app.use("/credit", creditRouter);
  app.use("/settings", settingsRouter);
  app.use("/terminals", terminalsRouter);
  app.use("/users", usersRouter);
}
