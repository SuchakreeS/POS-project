import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./env";
import { prisma } from "./lib/prisma";
import { errorHandler, notFound } from "./middleware/error-handler";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // behind Render's proxy: real client IP for the audit log
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // refresh-token cookie (SameSite=None; Secure) from Vercel → Render
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Health check. /health?db=1 also checks the database connection.
  app.get("/health", async (req, res) => {
    const result: { status: "ok"; time: string; db?: "ok" | "error" } = {
      status: "ok",
      time: new Date().toISOString(),
    };
    if (req.query.db === "1") {
      try {
        await prisma.$queryRaw`SELECT 1`;
        result.db = "ok";
      } catch {
        result.db = "error";
      }
    }
    res.json(result);
  });

  // Feature routes are mounted here from step 2 onwards, e.g.
  // app.use("/auth", authRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
