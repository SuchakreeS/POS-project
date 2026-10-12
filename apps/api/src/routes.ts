import type { Express } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { healthRouter } from "./modules/health/health.routes";
import { productsRouter } from "./modules/products/products.routes";
import { settingsRouter } from "./modules/settings/settings.routes";

/** Every feature router is mounted here — one place to see the whole API. */
export function registerRoutes(app: Express) {
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/categories", categoriesRouter);
  app.use("/products", productsRouter);
  app.use("/settings", settingsRouter);
}
