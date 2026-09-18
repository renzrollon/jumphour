// Task 3.2: persisting an installation from the Setup URL query must not
// call any GitHub write API. `fetchInstallationAccount` here is a fake that
// never touches the network (no HTTP client of any kind), so a passing
// suite proves the write path itself issues zero GitHub calls, let alone
// writes — the GitHub read this flow depends on is exercised separately in
// app-client.test.ts (task 3.1).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { recordInstallationFromSetup } from "./setup-installation";

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

describe("recordInstallationFromSetup", () => {
  it("records the installation via the injected (non-GitHub-write) account lookup", async () => {
    const fetchInstallationAccount = vi.fn().mockResolvedValue({
      accountId: 100,
      accountLogin: "acme",
      permissions: { metadata: "read" },
    });

    const outcome = await recordInstallationFromSetup({
      installationIdParam: "42",
      setupAction: "install",
      driver,
      fetchInstallationAccount,
    });

    expect(outcome).toEqual({ recorded: true, githubInstallationId: 42 });
    expect(fetchInstallationAccount).toHaveBeenCalledTimes(1);
    expect(fetchInstallationAccount).toHaveBeenCalledWith(42);

    expect(countInstallations()).toBe(1);
    const row = driver.get<{ account_id: number; account_login: string; permission_snapshot: string }>(
      "SELECT account_id, account_login, permission_snapshot FROM installations WHERE github_installation_id = ?",
      [42],
    );
    expect(row?.account_id).toBe(100);
    expect(row?.account_login).toBe("acme");
    expect(JSON.parse(row!.permission_snapshot)).toEqual({ metadata: "read" });
  });

  it("upserts in place on a second Setup visit for the same installation_id (task 2.2 uniqueness)", async () => {
    const fetchInstallationAccount = vi
      .fn()
      .mockResolvedValueOnce({ accountId: 100, accountLogin: "acme", permissions: null })
      .mockResolvedValueOnce({ accountId: 100, accountLogin: "acme-renamed", permissions: null });

    await recordInstallationFromSetup({
      installationIdParam: "42",
      setupAction: "install",
      driver,
      fetchInstallationAccount,
    });
    await recordInstallationFromSetup({
      installationIdParam: "42",
      setupAction: "update",
      driver,
      fetchInstallationAccount,
    });

    expect(countInstallations()).toBe(1);
    const row = driver.get<{ account_login: string }>(
      "SELECT account_login FROM installations WHERE github_installation_id = ?",
      [42],
    );
    expect(row?.account_login).toBe("acme-renamed");
  });

  it("does not record and does not call GitHub when installation_id is missing", async () => {
    const fetchInstallationAccount = vi.fn();

    const outcome = await recordInstallationFromSetup({
      installationIdParam: null,
      setupAction: null,
      driver,
      fetchInstallationAccount,
    });

    expect(outcome).toEqual({ recorded: false, reason: "missing installation_id" });
    expect(fetchInstallationAccount).not.toHaveBeenCalled();
    expect(countInstallations()).toBe(0);
  });

  it("does not record and does not call GitHub for a non-numeric installation_id", async () => {
    const fetchInstallationAccount = vi.fn();

    const outcome = await recordInstallationFromSetup({
      installationIdParam: "not-a-number",
      setupAction: "install",
      driver,
      fetchInstallationAccount,
    });

    expect(outcome.recorded).toBe(false);
    expect(fetchInstallationAccount).not.toHaveBeenCalled();
    expect(countInstallations()).toBe(0);
  });

  it("does not record a pending (non-admin-approved) install request", async () => {
    const fetchInstallationAccount = vi.fn();

    const outcome = await recordInstallationFromSetup({
      installationIdParam: "42",
      setupAction: "request",
      driver,
      fetchInstallationAccount,
    });

    expect(outcome.recorded).toBe(false);
    expect(fetchInstallationAccount).not.toHaveBeenCalled();
    expect(countInstallations()).toBe(0);
  });
});
