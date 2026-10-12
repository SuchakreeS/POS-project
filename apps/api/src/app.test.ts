import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

// Routes that don't need the database. Login/refresh against a real database are tested manually
// (see plan.md → step 2 checklist).
const app = createApp();

describe("app", () => {
  it("GET /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown route → 404 JSON", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("malformed JSON → 400", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("x-pos-client", "web")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });

  it("login validates input before touching the database", async () => {
    const res = await request(app)
      .post("/auth/login")
      .set("x-pos-client", "web")
      .send({ username: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Enter your username");
  });

  it("cookie routes require the client header (CSRF guard)", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(403);
  });

  it("refresh without a cookie → 401 SESSION_EXPIRED", async () => {
    const res = await request(app).post("/auth/refresh").set("x-pos-client", "web");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("logout without a cookie still succeeds and clears the cookie", async () => {
    const res = await request(app).post("/auth/logout").set("x-pos-client", "web");
    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^pos_refresh=;.*Path=\/auth/);
  });

  it("CORS allows the web app's origin with credentials", async () => {
    const res = await request(app)
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-pos-client");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
