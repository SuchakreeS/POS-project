// One-time database setup (plan step 1): `pnpm db:init`
//
// 1. Creates the first migration ("init") from prisma/schema.prisma without applying it.
// 2. Appends "ENABLE ROW LEVEL SECURITY" for every table to that migration.
//    Only the API talks to the database, so with RLS on and no policies, Supabase's public
//    Data API (anon / authenticated keys) can't read or write anything.
// 3. Applies the migration to the database in DIRECT_URL.
//
// Safe to run again: it skips steps that are already done.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "prisma/migrations";
const MARKER = "-- POS: row level security";

function prisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function migrationFolders() {
  if (!existsSync(MIGRATIONS)) return [];
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function rlsSql(schemaText) {
  const models = [...schemaText.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const lines = models.map((name) => `ALTER TABLE "${name}" ENABLE ROW LEVEL SECURITY;`);
  lines.push(`ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;`);
  return `\n\n${MARKER} (added by scripts/db-init.mjs)\n${lines.join("\n")}\n`;
}

if (!process.env.DIRECT_URL) {
  console.error(
    "❌ DIRECT_URL is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.",
  );
  process.exit(1);
}

if (migrationFolders().length === 0) {
  console.log("→ Creating the first migration (init)…");
  prisma(["migrate", "dev", "--name", "init", "--create-only"]);
}

const first = migrationFolders()[0];
if (!first) {
  console.error("❌ No migration was created.");
  process.exit(1);
}
const file = join(MIGRATIONS, first, "migration.sql");
const sql = readFileSync(file, "utf8");
if (!sql.includes(MARKER)) {
  writeFileSync(file, sql.trimEnd() + rlsSql(readFileSync("prisma/schema.prisma", "utf8")));
  console.log(`→ Added row level security to ${file}`);
}

console.log("→ Applying migrations…");
prisma(["migrate", "dev"]);
console.log("✅ Database ready. Next: pnpm db:seed");
