import {
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
  type ManagedUser,
  type UserList,
} from "@pos/shared";
import { Router } from "express";
import { requestContext } from "../../lib/request-context";
import { routeParam } from "../../lib/request-input";
import { requireAuth, requireRole } from "../../middleware/require-auth";
import { validateBody } from "../../middleware/validate";
import * as users from "./users.service";

/** /users — Users page (admin only). Users are turned off, never deleted. */
export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("ADMIN"));

usersRouter.get("/", async (_req, res) => {
  res.json({ items: await users.listUsers() } satisfies UserList);
});

usersRouter.post("/", validateBody(userCreateSchema), async (req, res) => {
  const user = await users.createUser(req.body, requestContext(req));
  res.status(201).json(user satisfies ManagedUser);
});

usersRouter.patch("/:id", validateBody(userUpdateSchema), async (req, res) => {
  const user = await users.updateUser(routeParam(req, "id"), req.body, requestContext(req));
  res.json(user satisfies ManagedUser);
});

usersRouter.post("/:id/deactivate", async (req, res) => {
  res.json(await users.setUserActive(routeParam(req, "id"), false, requestContext(req)));
});

usersRouter.post("/:id/reactivate", async (req, res) => {
  res.json(await users.setUserActive(routeParam(req, "id"), true, requestContext(req)));
});

usersRouter.post("/:id/reset-password", validateBody(passwordResetSchema), async (req, res) => {
  res.json(await users.resetPassword(routeParam(req, "id"), req.body, requestContext(req)));
});
