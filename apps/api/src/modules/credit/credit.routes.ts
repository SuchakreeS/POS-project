import {
  customerInputSchema,
  customerSearchSchema,
  repaymentInputSchema,
  type CustomerList,
} from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { parseQuery, routeParam } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as credit from "./credit.service";

/** /credit — customers, balances, history and repayments. Every signed-in user (plan.md → Roles). */
export const creditRouter = Router();
creditRouter.use(requireAuth);

creditRouter.get("/customers", async (req, res) => {
  const body: CustomerList = {
    items: await credit.listCustomers(parseQuery(customerSearchSchema, req)),
  };
  res.json(body);
});

creditRouter.get("/", async (_req, res) => {
  res.json(await credit.getBoard());
});

creditRouter.get("/customers/:id", async (req, res) => {
  res.json(await credit.getCustomerDetail(routeParam(req, "id")));
});

creditRouter.post("/customers", validateBody(customerInputSchema), async (req, res) => {
  res.status(201).json(await credit.createCustomer(req.body, requestContext(req)));
});

creditRouter.patch("/customers/:id", validateBody(customerInputSchema), async (req, res) => {
  res.json(await credit.updateCustomer(routeParam(req, "id"), req.body, requestContext(req)));
});

creditRouter.post("/repayments", validateBody(repaymentInputSchema), async (req, res) => {
  res.status(201).json(await credit.recordRepayment(req.body, requestContext(req)));
});
