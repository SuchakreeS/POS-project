import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const healthRouter = Router();

/** GET /health — is the API up? Add ?db=1 to also check the database connection. */
healthRouter.get("/", async (req, res) => {
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
