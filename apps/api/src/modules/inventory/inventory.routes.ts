import {
  adjustInputSchema,
  movementQuerySchema,
  restockInputSchema,
  type ProductList,
} from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { parseQuery } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as inventory from "./inventory.service";

/** /inventory — every signed-in user (plan.md → Roles: cashiers restock and adjust). */
export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

inventoryRouter.post("/restock", validateBody(restockInputSchema), async (req, res) => {
  const body: ProductList = { items: await inventory.restock(req.body, requestContext(req)) };
  res.json(body);
});

inventoryRouter.post("/adjust", validateBody(adjustInputSchema), async (req, res) => {
  res.json(await inventory.adjust(req.body, requestContext(req)));
});

inventoryRouter.get("/movements", async (req, res) => {
  res.json(await inventory.listMovements(parseQuery(movementQuerySchema, req)));
});
