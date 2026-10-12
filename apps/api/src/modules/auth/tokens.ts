import { ROLES, type Role } from "@pos/shared";
import { createHmac, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { AUTH } from "../../config";
import { env } from "../../env";

// ---------- Access tokens (short-lived JWT, kept in memory by the web app) ----------

export interface AccessClaims {
  userId: string;
  role: Role;
  displayName: string;
}

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, name: claims.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(AUTH.jwtIssuer)
    .setAudience(AUTH.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(AUTH.accessTokenTtl)
    .sign(accessKey);
}

/** Throws if the token is invalid or expired. */
export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    issuer: AUTH.jwtIssuer,
    audience: AUTH.jwtAudience,
    algorithms: ["HS256"],
  });
  const role = payload.role;
  if (!payload.sub || typeof payload.name !== "string" || !ROLES.includes(role as Role)) {
    throw new Error("Malformed access token");
  }
  return { userId: payload.sub, role: role as Role, displayName: payload.name };
}

// ---------- Refresh tokens (random, opaque, httpOnly cookie) ----------

export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What we store in Session.tokenHash. Keyed, so a leaked table alone can't be used to forge lookups. */
export function hashRefreshToken(token: string): string {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}
