import { z } from "zod";

/**
 * All environment variables are read and checked here, once, at startup.
 * The rest of the code imports `env` instead of touching process.env.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /** Signs access tokens (JWT, HS256). */
  JWT_ACCESS_SECRET: z.string().min(1).default("dev-access-secret"),
  /** HMAC key for storing refresh tokens (only their keyed hash is saved in the database). */
  JWT_REFRESH_SECRET: z.string().min(1).default("dev-refresh-secret"),
  REPORT_TIMEZONE: z.string().default("Asia/Bangkok"),
  INTERNAL_JOB_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_GROUP_ID: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    if (env[key].startsWith("dev-") || env[key].startsWith("change-me") || env[key].length < 32) {
      console.error(`❌ ${key} must be a real secret (32+ characters) in production.`);
      process.exit(1);
    }
  }
}
