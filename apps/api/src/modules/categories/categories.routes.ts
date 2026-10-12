import { categoryInputSchema, type CategoryList } from "@pos/shared";
import { Router } from "express";
import type { z } from "zod";
import { requestContext } from "../../lib/request-context";
import { routeParam } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as categories from "./categories.service";

type CategoryBody = z.output<typeof categoryInputSchema>;

/** /categories — every signed-in user (cashiers manage the catalog too, plan.md → Roles). */
export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (_req, res) => {
  const body: CategoryList = { items: await categories.listCategories() };
  res.json(body);
});

categoriesRouter.post("/", validateBody(categoryInputSchema), async (req, res) => {
  const { name }: CategoryBody = req.body;
  res.status(201).json(await categories.createCategory(name, requestContext(req)));
});

categoriesRouter.patch("/:id", validateBody(categoryInputSchema), async (req, res) => {
  const { name }: CategoryBody = req.body;
  res.json(await categories.renameCategory(routeParam(req, "id"), name, requestContext(req)));
});
