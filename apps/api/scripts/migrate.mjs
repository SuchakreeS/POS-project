// Create and apply a database migration, with row level security added automatically.
//
//   pnpm db:migrate --name add_sessions     (after editing prisma/schema.prisma)
//   pnpm db:init                            (first time: same as --name init)
//
// Steps:
// 1. `prisma migrate dev --create-only --name <name>` creates the migration SQL without applying it.
// 2. Every table created by that migration gets `ENABLE ROW LEVEL SECURITY` appended.
//    Only our API talks to the database, so RLS with no policies blocks Supabase's public
//    Data API (anon / authenticated keys) from reading or writing anything.
// 3. `prisma migrate dev` applies all pending migrations.
//
// If the schema has no changes, step 1 creates nothing and step 3 just applies pending ones.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { withRowLevelSecurity } from "./lib/rls.mjs";

const MIGRATIONS_DIR = "prisma/migrations";

function migrationFolders() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function prisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  const { values } = parseArgs({ options: { name: { type: "string" } } });

  if (!process.env.DIRECT_URL) {
    console.error(
      "❌ DIRECT_URL is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.",
    );
    process.exit(1);
  }

  const before = new Set(migrationFolders());
  const isFirst = before.size === 0;
  const name = values.name ?? (isFirst ? "init" : undefined);
  if (!name) {
    console.error("❌ Give the migration a name, e.g. pnpm db:migrate --name add_sessions");
    process.exit(1);
  }

  console.log(`→ Creating migration "${name}"…`);
  prisma(["migrate", "dev", "--create-only", "--name", name]);

  for (const folder of migrationFolders().filter((f) => !before.has(f))) {
    const file = join(MIGRATIONS_DIR, folder, "migration.sql");
    const sql = readFileSync(file, "utf8");
    const updated = withRowLevelSecurity(sql, { includeMigrationsTable: isFirst });
    if (updated !== sql) {
      writeFileSync(file, updated);
      console.log(`→ Added row level security for new tables in ${file}`);
    }
  }

  console.log("→ Applying migrations…");
  prisma(["migrate", "dev"]);
  console.log("✅ Database is up to date.");
}

main();
