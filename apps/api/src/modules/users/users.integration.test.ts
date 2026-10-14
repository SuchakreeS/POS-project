/**
 * Users page API against a real database (needs TEST_DATABASE_URL, see README).
 * Uses users "itestusr_…". Other active admins are turned off for this file and restored after,
 * so the "at least one active admin" rule can be tested (test files run one at a time).
 */
import type { ManagedUser } from "@pos/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  createTestUser,
  dbTestsEnabled,
  deleteTestUsers,
  refreshCookieOf,
} from "../../test/db-helpers";

const app = createApp();
const PREFIX = "itestusr_";
const CLIENT = { "x-pos-client": "web" };
let admin: { user: { id: string }; headers: Record<string, string> };
let cashier: { user: { id: string }; headers: Record<string, string> };
let parkedAdmins: string[] = [];

const as = (who: { headers: Record<string, string> }) => ({
  get: (path: string) => request(app).get(path).set(who.headers),
  post: (path: string, body: object = {}) => request(app).post(path).set(who.headers).send(body),
  patch: (path: string, body: object) => request(app).patch(path).set(who.headers).send(body),
});
const login = (username: string, password: string) =>
  request(app).post("/auth/login").set(CLIENT).send({ username, password });
const auditOf = (entityId: string, action: string) =>
  prisma.auditLog.findMany({ where: { entityId, action }, orderBy: { createdAt: "asc" } });

async function addUser(body: Partial<Record<string, string>> = {}): Promise<ManagedUser> {
  const res = await as(admin).post("/users", {
    displayName: "Nok",
    username: `${PREFIX}nok`,
    role: "CASHIER",
    password: "first-pass-1",
    ...body,
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe.skipIf(!dbTestsEnabled)("users API (database)", () => {
  beforeAll(async () => {
    const others = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, NOT: { username: { startsWith: PREFIX } } },
    });
    parkedAdmins = others.map((user) => user.id);
    await prisma.user.updateMany({
      where: { id: { in: parkedAdmins } },
      data: { isActive: false },
    });
  });
  beforeEach(async () => {
    await deleteTestUsers(PREFIX);
    admin = await createTestUser(`${PREFIX}boss`, "ADMIN");
    cashier = await createTestUser(`${PREFIX}cash`, "CASHIER");
  });
  afterAll(async () => {
    await deleteTestUsers(PREFIX);
    await prisma.user.updateMany({ where: { id: { in: parkedAdmins } }, data: { isActive: true } });
    await prisma.$disconnect();
  });

  it("is admin only", async () => {
    expect((await as(cashier).get("/users")).status).toBe(403);
    expect((await as(cashier).post("/users", {})).status).toBe(403);
    const list = await as(admin).get("/users");
    expect(list.status).toBe(200);
    expect(list.body.items.map((u: ManagedUser) => u.username)).toEqual(
      expect.arrayContaining([`${PREFIX}boss`, `${PREFIX}cash`]),
    );
  });

  it("adds a user who can log in; usernames are unique (ignoring case)", async () => {
    const user = await addUser({ username: ` ${PREFIX.toUpperCase()}Nok ` });
    expect(user).toMatchObject({
      username: `${PREFIX}nok`,
      role: "CASHIER",
      isActive: true,
      lastLoginAt: null,
    });
    expect(user).not.toHaveProperty("passwordHash");
    expect((await login(`${PREFIX}nok`, "first-pass-1")).status).toBe(200);

    const dup = await as(admin).post("/users", {
      displayName: "Other",
      username: `${PREFIX}NOK`,
      role: "CASHIER",
      password: "another-pass",
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.issues[0].path).toEqual(["username"]);

    const [audit] = await auditOf(user.id, "USER_CREATE");
    expect(audit?.after).toEqual({ username: `${PREFIX}nok`, displayName: "Nok", role: "CASHIER" });
    expect(JSON.stringify(audit)).not.toContain("first-pass-1");
  });

  it("edits name and role, logging USER_UPDATE and ROLE_CHANGE separately", async () => {
    const user = await addUser();
    const res = await as(admin).patch(`/users/${user.id}`, {
      displayName: "Nok K.",
      username: `${PREFIX}nok`,
      role: "ADMIN",
    });
    expect(res.body).toMatchObject({ displayName: "Nok K.", role: "ADMIN" });

    const [update] = await auditOf(user.id, "USER_UPDATE");
    expect(update).toMatchObject({
      before: { displayName: "Nok" },
      after: { displayName: "Nok K." },
    });
    const [role] = await auditOf(user.id, "ROLE_CHANGE");
    expect(role).toMatchObject({ before: { role: "CASHIER" }, after: { role: "ADMIN" } });
  });

  it("admins can't remove their own Admin role or turn themselves off", async () => {
    const self = await as(admin).patch(`/users/${admin.user.id}`, {
      displayName: "Boss",
      username: `${PREFIX}boss`,
      role: "CASHIER",
    });
    expect(self.status).toBe(400);
    expect(self.body.error.issues[0].path).toEqual(["role"]);
    expect((await as(admin).post(`/users/${admin.user.id}/deactivate`)).status).toBe(400);

    // Saving your own profile without a role change is fine.
    const rename = await as(admin).patch(`/users/${admin.user.id}`, {
      displayName: "The Boss",
      username: `${PREFIX}boss`,
      role: "ADMIN",
    });
    expect(rename.status).toBe(200);
  });

  // With no other active admin, two admins removing each other at once must leave one admin.
  const onlyActiveAdmins = () => prisma.user.count({ where: { role: "ADMIN", isActive: true } });

  /** One request won, the other was refused (400 by the rule, or 403 if it was already demoted). */
  const oneWins = (statuses: number[]) => {
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 400 || status === 403)).toHaveLength(1);
  };

  it("two admins demoting each other at once: one wins, one admin is left", async () => {
    const other = await createTestUser(`${PREFIX}other`, "ADMIN");
    const demote = (actor: typeof admin, id: string, username: string) =>
      as(actor).patch(`/users/${id}`, { displayName: "X", username, role: "CASHIER" });
    const results = await Promise.all([
      demote(admin, other.user.id, `${PREFIX}other`),
      demote(other, admin.user.id, `${PREFIX}boss`),
    ]);
    oneWins(results.map((r) => r.status));
    expect(await onlyActiveAdmins()).toBe(1);
  });

  it("two admins turning each other off at once: one wins, one admin is left", async () => {
    const other = await createTestUser(`${PREFIX}other`, "ADMIN");
    const results = await Promise.all([
      as(admin).post(`/users/${other.user.id}/deactivate`),
      as(other).post(`/users/${admin.user.id}/deactivate`),
    ]);
    oneWins(results.map((r) => r.status));
    expect(await onlyActiveAdmins()).toBe(1);
  });

  it("turning off logs the user out and blocks login; turning on lets them back", async () => {
    const user = await addUser();
    const session = await login(`${PREFIX}nok`, "first-pass-1");
    const cookie = refreshCookieOf(session);

    const off = await as(admin).post(`/users/${user.id}/deactivate`);
    expect(off.body.isActive).toBe(false);
    const refresh = await request(app).post("/auth/refresh").set(CLIENT).set("Cookie", cookie);
    expect(refresh.status).toBe(401);
    expect((await login(`${PREFIX}nok`, "first-pass-1")).status).toBe(403);
    expect(await auditOf(user.id, "USER_DEACTIVATE")).toHaveLength(1);

    await as(admin).post(`/users/${user.id}/reactivate`);
    expect((await login(`${PREFIX}nok`, "first-pass-1")).status).toBe(200);
  });

  it("a demoted admin loses admin routes at once, even with an old token", async () => {
    const other = await createTestUser(`${PREFIX}other`, "ADMIN");
    await as(admin).patch(`/users/${other.user.id}`, {
      displayName: "Other",
      username: `${PREFIX}other`,
      role: "CASHIER",
    });
    expect((await as(other).get("/users")).status).toBe(403); // token still says ADMIN
  });

  it("reset password: new one works, old one doesn't, sessions end, nothing secret in audit", async () => {
    const user = await addUser();
    const session = await login(`${PREFIX}nok`, "first-pass-1");

    const res = await as(admin).post(`/users/${user.id}/reset-password`, {
      password: "second-pass-2",
    });
    expect(res.status).toBe(200);
    expect((await login(`${PREFIX}nok`, "first-pass-1")).status).toBe(401);
    expect((await login(`${PREFIX}nok`, "second-pass-2")).status).toBe(200);
    const refresh = await request(app)
      .post("/auth/refresh")
      .set(CLIENT)
      .set("Cookie", refreshCookieOf(session));
    expect(refresh.status).toBe(401);

    const audits = await auditOf(user.id, "USER_UPDATE");
    expect(audits.at(-1)?.after).toEqual({ username: `${PREFIX}nok`, passwordReset: true });
    expect(JSON.stringify(audits)).not.toContain("second-pass-2");
    expect(
      (await as(admin).post(`/users/${user.id}/reset-password`, { password: "short" })).status,
    ).toBe(400);
  });
});
