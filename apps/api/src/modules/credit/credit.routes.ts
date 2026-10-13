import { customerSearchSchema, type CustomerList } from "@pos/shared";
import { Router } from "express";
import { parseQuery } from "../../lib/request-input";
import { requireAuth } from "../../middleware/require-auth";
import * as credit from "./credit.service";

/** /credit — customers and balances. History and repayments come in step 8. */
export const creditRouter = Router();
creditRouter.use(requireAuth);

creditRouter.get("/customers", async (req, res) => {
  const body: CustomerList = {
    items: await credit.listCustomers(parseQuery(customerSearchSchema, req)),
  };
  res.json(body);
});
