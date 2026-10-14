import { terminalInputSchema, type Terminal, type TerminalList } from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { requireAuth, requireRole } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import { createTerminal, listTerminals } from "./terminals.service";

/** /terminals — checkout devices. Each PC picks its own on the Settings page (saved in the browser). */
export const terminalsRouter = Router();
terminalsRouter.use(requireAuth);

terminalsRouter.get("/", async (_req, res) => {
  res.json({ items: await listTerminals() } satisfies TerminalList);
});

terminalsRouter.post(
  "/",
  requireRole("ADMIN"),
  validateBody(terminalInputSchema),
  async (req, res) => {
    const terminal = await createTerminal(req.body, requestContext(req));
    res.status(201).json(terminal satisfies Terminal);
  },
);
