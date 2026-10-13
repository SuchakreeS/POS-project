import { checkoutInputSchema, IDEMPOTENCY_HEADER } from "@pos/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error";
import { requestContext } from "../../lib/request-context";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as orders from "./orders.service";

/** /orders — checkout now; history and void come in step 9. */
export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const idempotencyKeySchema = z.uuid();

ordersRouter.post("/", validateBody(checkoutInputSchema), async (req, res) => {
  const key = idempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER));
  if (!key.success) throw HttpError.badRequest("Missing Idempotency-Key header (a UUID).");

  const { order, created } = await orders.checkout(req.body, key.data, requestContext(req));
  res.status(created ? 201 : 200).json(order);
});
