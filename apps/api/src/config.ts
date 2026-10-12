/** Fixed app settings (not secrets — those live in env.ts). */
export const AUTH = {
  /** Access token lifetime (sent as `Authorization: Bearer …`). */
  accessTokenTtl: "15m",
  /** Refresh session lifetime; extended on every refresh (sliding). */
  refreshTtlDays: 7,
  refreshCookieName: "pos_refresh",
  /** The refresh cookie is only sent to /auth/* routes. */
  refreshCookiePath: "/auth",
  jwtIssuer: "pos-api",
  jwtAudience: "pos-web",
  bcryptRounds: 12,
  /** Header the web app sends on every request; forces a CORS preflight, which blocks cross-site form posts. */
  clientHeader: "x-pos-client",
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
