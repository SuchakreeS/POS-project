import {
  productCreateSchema,
  productListQuerySchema,
  productStatusSchema,
  productUpdateSchema,
  type ProductList,
} from "@pos/shared";
import { Router } from "express";
import type { z } from "zod";
import { parseQuery, routeParam } from "../../lib/request-input";
import { requestContext } from "../../lib/request-context";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as products from "./products.service";

/** /products — every signed-in user (cashiers manage the catalog too, plan.md → Roles). */
export const productsRouter = Router();
productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
  const body: ProductList = {
    items: await products.listProducts(parseQuery(productListQuerySchema, req)),
  };
  res.json(body);
});

// Before "/:id" so "barcode" isn't taken as an id.
productsRouter.get("/barcode/:code", async (req, res) => {
  res.json(await products.findByBarcode(routeParam(req, "code").trim()));
});

productsRouter.get("/:id", async (req, res) => {
  res.json(await products.getProduct(routeParam(req, "id")));
});

productsRouter.post("/", validateBody(productCreateSchema), async (req, res) => {
  res.status(201).json(await products.createProduct(req.body, requestContext(req)));
});

productsRouter.patch("/:id", validateBody(productUpdateSchema), async (req, res) => {
  res.json(await products.updateProduct(routeParam(req, "id"), req.body, requestContext(req)));
});

type StatusBody = z.output<typeof productStatusSchema>;

productsRouter.post("/:id/deactivate", validateBody(productStatusSchema), async (req, res) => {
  const { reason }: StatusBody = req.body;
  res.json(
    await products.setProductActive(routeParam(req, "id"), false, reason, requestContext(req)),
  );
});

productsRouter.post("/:id/reactivate", validateBody(productStatusSchema), async (req, res) => {
  const { reason }: StatusBody = req.body;
  res.json(
    await products.setProductActive(routeParam(req, "id"), true, reason, requestContext(req)),
  );
});
