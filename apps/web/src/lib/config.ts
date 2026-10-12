/** Where the API lives. Set VITE_API_URL in apps/web/.env (Render URL in production). */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
);

/** Sent on every request. The API rejects auth calls without it (blocks cross-site form posts). */
export const CLIENT_HEADER = { "x-pos-client": "web" } as const;
