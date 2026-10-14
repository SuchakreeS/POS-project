import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DB integration files share one database, and some rules look at the whole table
    // ("at least one active admin"), so test files run one at a time.
    fileParallelism: false,
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    // env.ts validates on import; give tests safe values.
    // Unit tests never touch a database. Integration tests (*.integration.test.ts) run only when
    // TEST_DATABASE_URL points at a migrated, throwaway database — see README → Tests.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://test:test@127.0.0.1:1/test",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-0123456789-0123456789",
      CORS_ORIGIN: "http://localhost:5173",
    },
  },
});
