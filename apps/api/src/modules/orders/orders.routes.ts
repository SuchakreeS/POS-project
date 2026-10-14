import {
  checkoutInputSchema,
  IDEMPOTENCY_HEADER,
  orderListQuerySchema,
  voidInputSchema,
  type CheckoutResponse,
  type Order,
  type OrderPage,
} from "@pos/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http-error";
import { requestContext } from "../../lib/request-context";
import { parseQuery, routeParam } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as history from "./order-history.service";
import * as orders from "./orders.service";
import { voidOrder } from "./void-order.service";

/** /orders — checkout, bill history, bill detail and void. Cashiers and admins can all void. */
export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const idempotencyKeySchema = z.uuid();

ordersRouter.post("/", validateBody(checkoutInputSchema), async (req, res) => {
  const key = idempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER));
  if (!key.success) throw HttpError.badRequest("Missing Idempotency-Key header (a UUID).");

  const { created, ...body } = await orders.checkout(req.body, key.data, requestContext(req));
  res.status(created ? 201 : 200).json(body satisfies CheckoutResponse);
});

ordersRouter.get("/", async (req, res) => {
  res.json((await history.listOrders(parseQuery(orderListQuerySchema, req))) satisfies OrderPage);
});

ordersRouter.get("/:id", async (req, res) => {
  res.json((await history.getOrder(routeParam(req, "id"))) satisfies Order);
});

ordersRouter.post("/:id/void", validateBody(voidInputSchema), async (req, res) => {
  const order = await voidOrder(routeParam(req, "id"), req.body, requestContext(req));
  res.json(order satisfies Order);
});
