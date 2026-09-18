import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";

let migrationsDir: string | undefined;
let driver: SqlDriver | undefined;

afterEach(() => {
  driver?.close();
  driver = undefined;
  if (migrationsDir) {
    rmSync(migrationsDir, { recursive: true, force: true });
    migrationsDir = undefined;
  }
});

function fixtureDir(): string {
  migrationsDir = mkdtempSync(join(tmpdir(), "jumphour-migrations-"));
  return migrationsDir;
}

describe("runMigrations", () => {
  it("boots against an empty migrations directory (bootstrap has no product tables yet)", () => {
    const dir = fixtureDir();
    driver = createSqliteDriver(":memory:");

    const result = runMigrations(driver, dir);

    expect(result.applied).toEqual([]);
    expect(result.allApplied).toEqual([]);
    const tables = driver.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    );
    expect(tables).toHaveLength(1);
  });

  it("tolerates a missing migrations directory", () => {
    driver = createSqliteDriver(":memory:");

    const result = runMigrations(driver, join(tmpdir(), "jumphour-does-not-exist"));

    expect(result.applied).toEqual([]);
  });

  it("applies .sql files in filename order and records each one", () => {
    const dir = fixtureDir();
    writeFileSync(
      join(dir, "0002_second.sql"),
      "CREATE TABLE second (id INTEGER PRIMARY KEY); INSERT INTO second (id) VALUES (2);",
    );
    writeFileSync(
      join(dir, "0001_first.sql"),
      "CREATE TABLE first (id INTEGER PRIMARY KEY); INSERT INTO first (id) VALUES (1);",
    );
    driver = createSqliteDriver(":memory:");

    const result = runMigrations(driver, dir);

    expect(result.applied).toEqual(["0001_first.sql", "0002_second.sql"]);
    expect(driver.get<{ id: number }>("SELECT id FROM first")?.id).toBe(1);
    expect(driver.get<{ id: number }>("SELECT id FROM second")?.id).toBe(2);
  });

  it("is idempotent: a second run against the same database applies nothing new", () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, "0001_first.sql"), "CREATE TABLE first (id INTEGER PRIMARY KEY);");
    driver = createSqliteDriver(":memory:");

    runMigrations(driver, dir);
    const second = runMigrations(driver, dir);

    expect(second.applied).toEqual([]);
    expect(second.allApplied).toEqual(["0001_first.sql"]);
  });

  it("picks up a new migration file added after an earlier run without re-applying old ones", () => {
    const dir = fixtureDir();
    writeFileSync(join(dir, "0001_first.sql"), "CREATE TABLE first (id INTEGER PRIMARY KEY);");
    driver = createSqliteDriver(":memory:");
    runMigrations(driver, dir);

    writeFileSync(join(dir, "0002_second.sql"), "CREATE TABLE second (id INTEGER PRIMARY KEY);");
    const result = runMigrations(driver, dir);

    expect(result.applied).toEqual(["0002_second.sql"]);
    expect(result.allApplied).toEqual(["0001_first.sql", "0002_second.sql"]);
  });
});
