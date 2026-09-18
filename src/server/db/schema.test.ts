// Verifies the project's real migrations/ directory (not a fixture copy)
// applies cleanly to a fresh database and produces the tables task 2.1
// requires — see openspec/changes/github-app-and-openspec-discovery/tasks.md.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "migrations",
);

describe("project migrations", () => {
  it("apply cleanly on a fresh database and create the core product tables", () => {
    const driver = createSqliteDriver(":memory:");
    try {
      const result = runMigrations(driver, migrationsDir);

      expect(result.applied).toContain("0001_core_schema.sql");

      const tables = driver
        .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .map((row) => row.name)
        .sort();

      for (const expected of [
        "installations",
        "users",
        "sessions",
        "installation_repositories",
        "discovery_reports",
      ]) {
        expect(tables).toContain(expected);
      }
    } finally {
      driver.close();
    }
  });

  it("is idempotent against a clean database: re-running applies nothing new", () => {
    const driver = createSqliteDriver(":memory:");
    try {
      runMigrations(driver, migrationsDir);
      const second = runMigrations(driver, migrationsDir);

      expect(second.applied).toEqual([]);
    } finally {
      driver.close();
    }
  });
});
