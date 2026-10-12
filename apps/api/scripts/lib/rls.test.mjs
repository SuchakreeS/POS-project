import { describe, expect, it } from "vitest";
import { tablesCreatedIn, withRowLevelSecurity } from "./rls.mjs";

const sql = `-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
ALTER TABLE "User" ADD COLUMN "x" TEXT;`;

describe("row level security helper", () => {
  it("finds only tables created by the migration", () => {
    expect(tablesCreatedIn(sql)).toEqual(["Session"]);
  });

  it("appends RLS once", () => {
    const once = withRowLevelSecurity(sql);
    expect(once).toContain('ALTER TABLE IF EXISTS "Session" ENABLE ROW LEVEL SECURITY;');
    expect(withRowLevelSecurity(once)).toBe(once);
  });

  it("leaves migrations without new tables untouched", () => {
    const alterOnly = 'ALTER TABLE "User" ADD COLUMN "x" TEXT;';
    expect(withRowLevelSecurity(alterOnly)).toBe(alterOnly);
  });

  it("covers the migrations table on the first migration", () => {
    expect(withRowLevelSecurity(sql, { includeMigrationsTable: true })).toContain(
      '"_prisma_migrations"',
    );
  });
});
