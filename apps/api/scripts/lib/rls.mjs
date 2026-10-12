// Pure helpers for adding row level security to Prisma migration SQL (used by migrate.mjs).

export const RLS_MARKER = "-- POS: row level security";

/** Names of tables created by a migration (`CREATE TABLE "Name"`). */
export function tablesCreatedIn(sql) {
  return [...sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)].map((match) => match[1]);
}

/** Append `ENABLE ROW LEVEL SECURITY` for every new table. Idempotent. */
export function withRowLevelSecurity(sql, { includeMigrationsTable = false } = {}) {
  if (sql.includes(RLS_MARKER)) return sql;
  const tables = tablesCreatedIn(sql);
  if (includeMigrationsTable) tables.push("_prisma_migrations");
  if (tables.length === 0) return sql;
  const lines = tables.map(
    (table) => `ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`,
  );
  return `${sql.trimEnd()}\n\n${RLS_MARKER} (added by scripts/migrate.mjs)\n${lines.join("\n")}\n`;
}
