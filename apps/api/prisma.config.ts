import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI config (migrate, seed, studio).
// Migrations use DIRECT_URL (Supabase session pooler / direct connection).
// The running app uses DATABASE_URL (Supabase transaction pooler) — see src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read lazily so `prisma generate` (runs on install) works before .env exists.
    // migrate / seed / studio need DIRECT_URL set in apps/api/.env.
    url: process.env.DIRECT_URL ?? "",
  },
});
