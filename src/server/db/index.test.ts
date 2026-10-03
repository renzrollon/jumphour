import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDriver, resetDriverForTests } from "./index";

const savedDatabasePath = process.env.DATABASE_PATH;
let tmpDir: string | undefined;

afterEach(() => {
  resetDriverForTests();
  if (savedDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = savedDatabasePath;
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe("getDriver", () => {
  it("opens the SQLite file named by DATABASE_PATH, creating parent directories", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "jumphour-db-"));
    const dbFile = join(tmpDir, "nested", "jumphour.sqlite3");
    process.env.DATABASE_PATH = dbFile;

    const driver = getDriver();
    driver.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");

    expect(existsSync(dbFile)).toBe(true);
  });

  it("returns the same connection across calls until reset", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "jumphour-db-"));
    process.env.DATABASE_PATH = join(tmpDir, "jumphour.sqlite3");

    expect(getDriver()).toBe(getDriver());
  });
});
