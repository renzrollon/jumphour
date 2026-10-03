// Task 8.4: the callback half of Refresh — re-bind the brand-new session to
// the installation the user was refreshing, then re-list and re-discover it.
// Same injected-fake convention as ./recover-installations.test.ts, so no
// GitHub call and no module mocking is involved.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { completeRefreshCallback } from "./complete-refresh-callback";
import { getSession } from "../db/sessions";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

const SESSION_ID = "sess-new";
const INSTALLATION_ID = 7;

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [INSTALLATION_ID, 100, "acme", now, now],
  );
  driver.run(`INSERT INTO users (github_user_id, login) VALUES (?, ?)`, [1, "octocat"]);
  // As completeOAuthSignIn leaves it: a fresh session with no installation.
  driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, NULL)`, [SESSION_ID, 1]);
});

afterEach(() => {
  driver.close();
});

const mintOk = async () => ({ token: "ghs_minted" });
const refreshOk = async () => ({ status: "ok" as const, repositories: [{}, {}] });

describe("completeRefreshCallback", () => {
  it("re-binds the new session to the refreshed installation and re-lists it", async () => {
    const refresh = vi.fn(refreshOk);

    const outcome = await completeRefreshCallback({
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: mintOk,
      refresh,
    });

    expect(outcome).toEqual({ refreshed: true, installationId: INSTALLATION_ID, repositoryCount: 2 });
    // Without this the user returns from Refresh signed in but looking at
    // an empty surface.
    expect(getSession(driver, SESSION_ID)?.installationId).toBe(INSTALLATION_ID);
    expect(refresh).toHaveBeenCalledWith({
      installationId: INSTALLATION_ID,
      installationToken: "ghs_minted",
    });
  });

  it("refuses an installation GitHub did not confirm for this user, and refreshes nothing", async () => {
    const refresh = vi.fn(refreshOk);

    const outcome = await completeRefreshCallback({
      sessionId: SESSION_ID,
      // `state` came back from the browser naming an installation this user
      // has no access to.
      installationId: 999,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: mintOk,
      refresh,
    });

    expect(outcome.refreshed).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(getSession(driver, SESSION_ID)?.installationId).toBeNull();
  });

  it("reports rather than throws when no installation token can be minted", async () => {
    const refresh = vi.fn(refreshOk);

    const outcome = await completeRefreshCallback({
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: async () => {
        throw new Error("App credentials are not configured");
      },
      refresh,
    });

    expect(outcome).toEqual({
      refreshed: false,
      reason: "could not mint an installation token: App credentials are not configured",
    });
    expect(refresh).not.toHaveBeenCalled();
    // The switch still happened — the user lands on the right installation
    // even though its rows could not be refreshed this time.
    expect(getSession(driver, SESSION_ID)?.installationId).toBe(INSTALLATION_ID);
  });

  it("reports a failed GitHub listing instead of claiming a refresh", async () => {
    const outcome = await completeRefreshCallback({
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: mintOk,
      refresh: async () => ({ status: "failed" as const, repositories: [] }),
    });

    expect(outcome).toEqual({ refreshed: false, reason: "GitHub repository listing failed" });
  });

  it("reports rather than throws when the refresh itself rejects", async () => {
    const outcome = await completeRefreshCallback({
      sessionId: SESSION_ID,
      installationId: INSTALLATION_ID,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: mintOk,
      refresh: async () => {
        throw new Error("network down");
      },
    });

    expect(outcome).toEqual({ refreshed: false, reason: "refresh failed: network down" });
  });

  it("refuses when the session does not exist", async () => {
    const outcome = await completeRefreshCallback({
      sessionId: "no-such-session",
      installationId: INSTALLATION_ID,
      accessibleInstallationIds: [INSTALLATION_ID],
      driver,
      mintInstallationToken: mintOk,
      refresh: vi.fn(refreshOk),
    });

    expect(outcome.refreshed).toBe(false);
  });
});
