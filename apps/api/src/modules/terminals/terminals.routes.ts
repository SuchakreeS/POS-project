import type { TerminalList } from "@pos/shared";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/require-auth";

/** /terminals — the checkout devices. The web app picks one per PC (Settings lets admins change it). */
export const terminalsRouter = Router();
terminalsRouter.use(requireAuth);

terminalsRouter.get("/", async (_req, res) => {
  const terminals = await prisma.terminal.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const body: TerminalList = { items: terminals };
  res.json(body);
});
