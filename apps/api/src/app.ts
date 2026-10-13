import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { IDEMPOTENCY_HEADER } from "@pos/shared";
import { AUTH } from "./config";
import { env } from "./env";
import { errorHandler, notFound } from "./middleware/error-handler";
import { registerRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // behind Render's proxy: real client IP for the audit log
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // refresh-token cookie (SameSite=None; Secure in production)
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        AUTH.clientHeader,
        "x-terminal-id",
        IDEMPOTENCY_HEADER,
      ],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  registerRoutes(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
