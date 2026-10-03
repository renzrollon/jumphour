// Task 3.3: a signed-in user with an install GitHub knows about (via
// GET /user/installations) but that Jumphour never saw a Setup URL
// redirect for gets a stored `installations` row — without any GitHub
// write call. specs/github-app-installation/spec.md "Happy path —
// administrator installs for selected repositories": "the system records
// that installation".
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { recoverMissedInstallations } from "./recover-installations";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

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

describe("recoverMissedInstallations", () => {
  it("persists an installation GitHub reports that Jumphour has no row for yet (missed Setup redirect)", async () => {
    const listInstallations = vi.fn().mockResolvedValue([
      { githubInstallationId: 42, accountId: 100, accountLogin: "acme", permissions: { metadata: "read" } },
    ]);

    const outcome = await recoverMissedInstallations({
      accessToken: "gho_fake",
      driver,
      listInstallations,
    });

    expect(listInstallations).toHaveBeenCalledWith("gho_fake");
    expect(outcome.recordedIds).toEqual([42]);
    expect(countInstallations()).toBe(1);

    const row = driver.get<{ account_id: number; account_login: string; permission_snapshot: string }>(
      "SELECT account_id, account_login, permission_snapshot FROM installations WHERE github_installation_id = ?",
      [42],
    );
    expect(row?.account_id).toBe(100);
    expect(row?.account_login).toBe("acme");
    expect(JSON.parse(row!.permission_snapshot)).toEqual({ metadata: "read" });
  });

  it("does not touch an installation Jumphour already knows about (no duplicate, not counted as recorded)", async () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [42, 100, "acme", now, now],
    );

    const listInstallations = vi
      .fn()
      .mockResolvedValue([{ githubInstallationId: 42, accountId: 100, accountLogin: "acme", permissions: null }]);

    const outcome = await recoverMissedInstallations({ accessToken: "gho_fake", driver, listInstallations });

    expect(outcome.recordedIds).toEqual([]);
    expect(countInstallations()).toBe(1);
  });

  it("records only the unknown ids out of a mixed known/unknown list", async () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [1, 10, "known-org", now, now],
    );

    const listInstallations = vi.fn().mockResolvedValue([
      { githubInstallationId: 1, accountId: 10, accountLogin: "known-org", permissions: null },
      { githubInstallationId: 2, accountId: 20, accountLogin: "unknown-org", permissions: null },
    ]);

    const outcome = await recoverMissedInstallations({ accessToken: "gho_fake", driver, listInstallations });

    expect(outcome.recordedIds).toEqual([2]);
    expect(countInstallations()).toBe(2);
  });

  it("never calls a GitHub write endpoint: the only GitHub interaction is the injected (read) listInstallations", async () => {
    const listInstallations = vi.fn().mockResolvedValue([]);

    const outcome = await recoverMissedInstallations({ accessToken: "gho_fake", driver, listInstallations });

    expect(listInstallations).toHaveBeenCalledTimes(1);
    expect(outcome.installations).toEqual([]);
    expect(outcome.recordedIds).toEqual([]);
    expect(countInstallations()).toBe(0);
  });
});
