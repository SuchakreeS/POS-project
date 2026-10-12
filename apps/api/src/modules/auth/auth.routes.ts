import { loginInputSchema, type AuthResponse } from "@pos/shared";
import { Router, type Response } from "express";
import type { z } from "zod";
import { HttpError } from "../../lib/http-error";
import { requestMeta } from "../../lib/request-meta";
import { loginRateLimit } from "../../middleware/rate-limit";
import { getAuth, requireAuth } from "../../middleware/require-auth";
import { requireClientHeader } from "../../middleware/require-client-header";
import { validateBody } from "../../middleware/validate";
import * as authService from "./auth.service";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./cookies";

export const authRouter = Router();

function sendSession(res: Response, session: authService.SessionTokens) {
  setRefreshCookie(res, session.refreshToken);
  const body: AuthResponse = { accessToken: session.accessToken, user: session.user };
  res.json(body);
}

authRouter.post(
  "/login",
  requireClientHeader,
  validateBody(loginInputSchema),
  loginRateLimit,
  async (req, res) => {
    const input: z.output<typeof loginInputSchema> = req.body;
    sendSession(res, await authService.login(input, requestMeta(req)));
  },
);

authRouter.post("/refresh", requireClientHeader, async (req, res) => {
  try {
    sendSession(res, await authService.refresh(readRefreshCookie(req), requestMeta(req)));
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) clearRefreshCookie(res);
    throw error;
  }
});

authRouter.post("/logout", requireClientHeader, async (req, res) => {
  await authService.logout(readRefreshCookie(req), requestMeta(req));
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await authService.currentUser(getAuth(req).userId) });
});
