import { shopSettingsInputSchema, type ShopSettings } from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { requireAuth, requireRole } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import { getShopSettings, updateShopSettings } from "./settings.service";

/** /settings — everyone signed in can read (forms need the defaults); only admins save. */
export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (_req, res) => {
  res.json((await getShopSettings()) satisfies ShopSettings);
});

settingsRouter.patch(
  "/",
  requireRole("ADMIN"),
  validateBody(shopSettingsInputSchema),
  async (req, res) => {
    res.json((await updateShopSettings(req.body, requestContext(req))) satisfies ShopSettings);
  },
);
