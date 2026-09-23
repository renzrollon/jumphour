// Task 2.2: unique `github_installation_id` and the upsert write path built
// on it — see openspec/changes/github-app-and-openspec-discovery/tasks.md.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";
import { getInstallation, upsertInstallation } from "./installations";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "migrations",
);

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
});

afterEach(() => {
  driver.close();
});

function countInstallations(): number {
  return driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM installations")!.n;
}

describe("installations uniqueness and upsert", () => {
  it("rejects a second row with the same github_installation_id at the schema level", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [1, 100, "acme", now, now],
    );

    expect(() =>
      driver.run(
        `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [1, 100, "acme", now, now],
      ),
    ).toThrow();
  });

  it("upsertInstallation inserts a new installation once", () => {
    upsertInstallation(driver, { githubInstallationId: 1, accountId: 100, accountLogin: "acme" });

    expect(countInstallations()).toBe(1);
    const row = driver.get<{ account_login: string }>(
      "SELECT account_login FROM installations WHERE github_installation_id = ?",
      [1],
    );
    expect(row?.account_login).toBe("acme");
  });

  it("upsertInstallation called again for the same id updates the row instead of duplicating it", () => {
    upsertInstallation(driver, { githubInstallationId: 1, accountId: 100, accountLogin: "acme" });
    upsertInstallation(driver, { githubInstallationId: 1, accountId: 100, accountLogin: "acme-renamed" });

    expect(countInstallations()).toBe(1);
    const row = driver.get<{ account_login: string }>(
      "SELECT account_login FROM installations WHERE github_installation_id = ?",
      [1],
    );
    expect(row?.account_login).toBe("acme-renamed");
  });
});

describe("getInstallation", () => {
  it("returns the id and account login of a stored installation", () => {
    upsertInstallation(driver, { githubInstallationId: 42, accountId: 100, accountLogin: "acme" });

    expect(getInstallation(driver, 42)).toEqual({ installationId: 42, accountLogin: "acme" });
  });

  it("returns undefined for an installation id that is not stored", () => {
    upsertInstallation(driver, { githubInstallationId: 42, accountId: 100, accountLogin: "acme" });

    expect(getInstallation(driver, 999)).toBeUndefined();
  });
});
