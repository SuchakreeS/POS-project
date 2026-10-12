import type { Express } from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { healthRouter } from "./modules/health/health.routes";

/** Every feature router is mounted here — one place to see the whole API. */
export function registerRoutes(app: Express) {
  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
}
