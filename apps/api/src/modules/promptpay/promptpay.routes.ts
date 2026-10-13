import {
  promptpayReceiveSchema,
  promptpayUndoSchema,
  type PromptPayReceiveInput,
  type PromptPayUndoInput,
} from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { routeParam } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as promptpay from "./promptpay.service";

/** /promptpay — every signed-in user checks payments (plan.md → Roles). */
export const promptpayRouter = Router();
promptpayRouter.use(requireAuth);

promptpayRouter.get("/", async (_req, res) => {
  res.json(await promptpay.getBoard());
});

promptpayRouter.get("/summary", async (_req, res) => {
  res.json(await promptpay.getSummary());
});

promptpayRouter.post("/receive", validateBody(promptpayReceiveSchema), async (req, res) => {
  const { orderIds }: PromptPayReceiveInput = req.body;
  res.json({ items: await promptpay.markReceived(orderIds, requestContext(req)) });
});

promptpayRouter.post("/:orderId/undo", validateBody(promptpayUndoSchema), async (req, res) => {
  const { reason }: PromptPayUndoInput = req.body;
  res.json(await promptpay.undoReceived(routeParam(req, "orderId"), reason, requestContext(req)));
});
