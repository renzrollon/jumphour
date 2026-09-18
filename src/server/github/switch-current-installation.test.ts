// Task 7.2: specs/github-app-installation/spec.md "Edge case — same GitHub
// user in two installations": switching from A to B leaves the repository
// list and discovery reports as B's only — A and B are not merged into one
// list.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { listInstallationRepositories, upsertInstallationRepository } from "../db/installation-repositories";
import { getSession } from "../db/sessions";
import { switchCurrentInstallation } from "./switch-current-installation";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();

  // Installation A (1) and installation B (2), the same signed-in GitHub
  // user authorized in both.
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [1, 100, "acme", now, now],
  );
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [2, 200, "other-org", now, now],
  );
  driver.run(`INSERT INTO users (github_user_id, login) VALUES (?, ?)`, [7, "octocat"]);
  driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, [
    "session-1",
    7,
    1,
  ]);

  // A's repositories.
  upsertInstallationRepository(driver, { installationId: 1, githubRepoId: 42, fullName: "acme/api-gateway" });
  upsertInstallationRepository(driver, { installationId: 1, githubRepoId: 43, fullName: "acme/billing" });
  // B's repositories — includes the same github_repo_id (42) as A under a
  // different name, mirroring the cross-installation fixture task 7.1 used.
  upsertInstallationRepository(driver, {
    installationId: 2,
    githubRepoId: 42,
    fullName: "other-org/public-tools",
  });
});

afterEach(() => {
  driver.close();
});

describe("switchCurrentInstallation", () => {
  it("switching from A to B updates the session's current installation", () => {
    const outcome = switchCurrentInstallation({
      sessionId: "session-1",
      targetInstallationId: 2,
      accessibleInstallationIds: [1, 2],
      driver,
    });

    expect(outcome).toEqual({ switched: true, installationId: 2 });
    expect(getSession(driver, "session-1")?.installationId).toBe(2);
  });

  it("after switching from A to B, the repository list for the session's new current installation is B's only — not merged with A's", () => {
    switchCurrentInstallation({
      sessionId: "session-1",
      targetInstallationId: 2,
      accessibleInstallationIds: [1, 2],
      driver,
    });

    const currentInstallationId = getSession(driver, "session-1")!.installationId!;
    const rows = listInstallationRepositories(driver, currentInstallationId);

    expect(rows).toEqual([{ installationId: 2, githubRepoId: 42, fullName: "other-org/public-tools" }]);
    // Not a merge: A's repositories (billing, and A's own api-gateway name
    // for the shared github_repo_id 42) are absent from the post-switch list.
    expect(rows.some((row) => row.fullName === "acme/api-gateway")).toBe(false);
    expect(rows.some((row) => row.fullName === "acme/billing")).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it("switching does not alter or drop installation A's own stored data", () => {
    switchCurrentInstallation({
      sessionId: "session-1",
      targetInstallationId: 2,
      accessibleInstallationIds: [1, 2],
      driver,
    });

    const rowsForA = listInstallationRepositories(driver, 1);
    expect(rowsForA).toEqual([
      { installationId: 1, githubRepoId: 42, fullName: "acme/api-gateway" },
      { installationId: 1, githubRepoId: 43, fullName: "acme/billing" },
    ]);
  });

  it("refuses to switch to an installation GitHub has not confirmed for this user, and leaves the session's current installation unchanged", () => {
    const outcome = switchCurrentInstallation({
      sessionId: "session-1",
      targetInstallationId: 2,
      // GitHub's GET /user/installations only confirmed installation 1 for
      // this user this time — installation 2 exists in Jumphour's storage
      // (some other user's installation) but not for this signed-in user.
      accessibleInstallationIds: [1],
      driver,
    });

    expect(outcome).toEqual({
      switched: false,
      reason: "installation 2 is not accessible to this signed-in user",
    });
    expect(getSession(driver, "session-1")?.installationId).toBe(1);
  });

  it("refuses to switch a session id that does not exist", () => {
    const outcome = switchCurrentInstallation({
      sessionId: "no-such-session",
      targetInstallationId: 2,
      accessibleInstallationIds: [1, 2],
      driver,
    });

    expect(outcome).toEqual({ switched: false, reason: "no session found for id no-such-session" });
  });
});
