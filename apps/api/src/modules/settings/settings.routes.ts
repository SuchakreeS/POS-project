import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth";
import { getShopSettings } from "./settings.service";

/** /settings — everyone signed in can read (forms need the defaults). Saving is admin-only (step 10). */
export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (_req, res) => {
  res.json(await getShopSettings());
});
