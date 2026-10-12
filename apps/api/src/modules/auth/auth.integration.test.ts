/**
 * Full login → refresh → logout flow against a real database.
 * Runs only with TEST_DATABASE_URL set to a migrated throwaway database:
 *   TEST_DATABASE_URL="postgresql://postgres:pw@localhost:5432/pos_test" pnpm --filter @pos/api test
 * Only touches users whose username starts with "itest_".
 */
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "./password";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const PREFIX = "itest_";
const PASSWORD = "correct-horse-1";
const app = createApp();

async function cleanup() {
  const users = await prisma.user.findMany({ where: { username: { startsWith: PREFIX } } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { userName: { startsWith: PREFIX } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } }); // sessions cascade
}

async function createUser(
  name: string,
  opts: { role?: "ADMIN" | "CASHIER"; isActive?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      username: `${PREFIX}${name}`,
      displayName: name,
      role: opts.role ?? "CASHIER",
      isActive: opts.isActive ?? true,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

const login = (username: string, password = PASSWORD) =>
  request(app).post("/auth/login").set("x-pos-client", "web").send({ username, password });

const refreshCookieOf = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers["set-cookie"] ?? [])
    .find((c) => c.startsWith("pos_refresh="))
    ?.split(";")[0];

describe.skipIf(!enabled)("auth flow (database)", () => {
  beforeEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("logs in, returns the user, sets the refresh cookie, records LOGIN and lastLoginAt", async () => {
    const user = await createUser("ploy");
    const res = await login(`  ${PREFIX.toUpperCase()}PLOY `); // case/space insensitive

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: user.id,
      username: user.username,
      displayName: "ploy",
      role: "CASHIER",
    });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"]?.[0]).toMatch(/pos_refresh=.+HttpOnly/);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.lastLoginAt).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { userId: user.id, action: "LOGIN" } })).toBe(1);
  });

  it("wrong password → 401 INVALID_CREDENTIALS and LOGIN_FAILED", async () => {
    const user = await createUser("nok");
    const res = await login(user.username, "nope-nope");
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Wrong username or password.",
    });
    expect(
      await prisma.auditLog.count({ where: { userId: user.id, action: "LOGIN_FAILED" } }),
    ).toBe(1);
  });

  it("unknown user → same 401 as a wrong password", async () => {
    const res = await login(`${PREFIX}ghost`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(
      await prisma.auditLog.count({
        where: { userName: `${PREFIX}ghost`, action: "LOGIN_FAILED" },
      }),
    ).toBe(1);
  });

  it("turned-off user with the right password → 403 ACCOUNT_DISABLED", async () => {
    const user = await createUser("mint", { isActive: false });
    const res = await login(user.username);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("access token works on /auth/me", async () => {
    const user = await createUser("bank", { role: "ADMIN" });
    const { body } = await login(user.username);
    const me = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("ADMIN");
  });

  it("refresh rotates the token: new one works, old one is dead", async () => {
    const user = await createUser("lek");
    const first = refreshCookieOf(await login(user.username))!;

    const refreshed = await request(app)
      .post("/auth/refresh")
      .set("x-pos-client", "web")
      .set("Cookie", first);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.id).toBe(user.id);
    const second = refreshCookieOf(refreshed)!;
    expect(second).not.toBe(first);

    const reuse = await request(app)
      .post("/auth/refresh")
      .set("x-pos-client", "web")
      .set("Cookie", first);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("SESSION_EXPIRED");

    const again = await request(app)
      .post("/auth/refresh")
      .set("x-pos-client", "web")
      .set("Cookie", second);
    expect(again.status).toBe(200);
  });

  it("logout revokes the session and records LOGOUT", async () => {
    const user = await createUser("arm");
    const cookie = refreshCookieOf(await login(user.username))!;

    const out = await request(app)
      .post("/auth/logout")
      .set("x-pos-client", "web")
      .set("Cookie", cookie);
    expect(out.status).toBe(204);

    const after = await request(app)
      .post("/auth/refresh")
      .set("x-pos-client", "web")
      .set("Cookie", cookie);
    expect(after.status).toBe(401);
    expect(await prisma.auditLog.count({ where: { userId: user.id, action: "LOGOUT" } })).toBe(1);
  });

  it("a turned-off user can't refresh an existing session", async () => {
    const user = await createUser("dang");
    const cookie = refreshCookieOf(await login(user.username))!;
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(app)
      .post("/auth/refresh")
      .set("x-pos-client", "web")
      .set("Cookie", cookie);
    expect(res.status).toBe(401);
  });
});
