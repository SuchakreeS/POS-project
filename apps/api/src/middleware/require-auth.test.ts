import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../modules/auth/tokens";
import { errorHandler } from "./error-handler";
import { getAuth, requireAuth, requireRole } from "./require-auth";

// requireRole re-reads the user's role; stand in for the database.
vi.mock("../lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
const findUser = vi.mocked(prisma.user.findUnique);
const inDatabase = (row: { role: "ADMIN" | "CASHIER"; isActive: boolean } | null) =>
  findUser.mockResolvedValue(row as Awaited<ReturnType<typeof prisma.user.findUnique>>);

function testApp() {
  const app = express();
  app.get("/me", requireAuth, (req, res) => {
    res.json(getAuth(req));
  });
  app.get("/admin", requireAuth, requireRole("ADMIN"), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

const tokenFor = (role: "ADMIN" | "CASHIER") =>
  signAccessToken({ userId: `${role}-id`, role, displayName: role });

describe("requireAuth", () => {
  it("401 UNAUTHORIZED without a token", async () => {
    const res = await request(testApp()).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("401 SESSION_EXPIRED with a bad token", async () => {
    const res = await request(testApp()).get("/me").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("sets req.auth from a valid token", async () => {
    const res = await request(testApp())
      .get("/me")
      .set("Authorization", `Bearer ${await tokenFor("CASHIER")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: "CASHIER-id", role: "CASHIER", displayName: "CASHIER" });
  });
});

describe("requireRole", () => {
  beforeEach(() => inDatabase({ role: "ADMIN", isActive: true }));

  it("403 for a cashier on an admin route", async () => {
    const res = await request(testApp())
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor("CASHIER")}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("lets an admin through", async () => {
    const res = await request(testApp())
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor("ADMIN")}`);
    expect(res.status).toBe(200);
  });

  it("403 when the admin was demoted after the token was issued", async () => {
    inDatabase({ role: "CASHIER", isActive: true });
    const res = await request(testApp())
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor("ADMIN")}`);
    expect(res.status).toBe(403);
  });

  it("401 SESSION_EXPIRED when the admin was turned off", async () => {
    inDatabase({ role: "ADMIN", isActive: false });
    const res = await request(testApp())
      .get("/admin")
      .set("Authorization", `Bearer ${await tokenFor("ADMIN")}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });
});
