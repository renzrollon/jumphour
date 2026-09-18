// Task 4.4: specs/github-app-installation/spec.md "Edge case — repository
// outside the installation" — GIVEN an installation that includes
// `acme/api-gateway` and does not include `acme/secret-ledger`, WHEN a
// signed-in user requests `acme/secret-ledger`, THEN the system refuses the
// request AND does not read that repository through the App.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { upsertInstallationRepository } from "../db/installation-repositories";
import { authorizeRepositoryRequest, handleRepositoryContentsRequest } from "./authorize-repository-request";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

// github_repo_id 1 = acme/api-gateway (in the installation);
// github_repo_id 2 = acme/secret-ledger (never inserted — outside it).
const IN_INSTALLATION_REPO_ID = 1;
const OUTSIDE_INSTALLATION_REPO_ID = 2;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [1, 100, "acme", now, now],
  );
  upsertInstallationRepository(driver, {
    installationId: 1,
    githubRepoId: IN_INSTALLATION_REPO_ID,
    fullName: "acme/api-gateway",
  });
});

afterEach(() => {
  driver.close();
});

describe("authorizeRepositoryRequest", () => {
  it("authorizes a repository present in the current installation", () => {
    const outcome = authorizeRepositoryRequest({
      installationId: 1,
      githubRepoId: IN_INSTALLATION_REPO_ID,
      driver,
    });

    expect(outcome).toEqual({ authorized: true });
  });

  it("refuses a repository not in the current installation", () => {
    const outcome = authorizeRepositoryRequest({
      installationId: 1,
      githubRepoId: OUTSIDE_INSTALLATION_REPO_ID,
      driver,
    });

    expect(outcome).toEqual({
      authorized: false,
      reason: `repository ${OUTSIDE_INSTALLATION_REPO_ID} is not in installation 1`,
    });
  });
});

describe("handleRepositoryContentsRequest", () => {
  it("calls fetchContents for a repository in the current installation", async () => {
    const fetchContents = vi.fn().mockResolvedValue({ ok: true });

    const outcome = await handleRepositoryContentsRequest({
      installationId: 1,
      githubRepoId: IN_INSTALLATION_REPO_ID,
      driver,
      fetchContents,
    });

    expect(outcome).toEqual({ status: "ok", data: { ok: true } });
    expect(fetchContents).toHaveBeenCalledWith(IN_INSTALLATION_REPO_ID);
  });

  it("refuses a repository outside the installation and never calls fetchContents (no GitHub read)", async () => {
    const fetchContents = vi.fn().mockResolvedValue({ ok: true });

    const outcome = await handleRepositoryContentsRequest({
      installationId: 1,
      githubRepoId: OUTSIDE_INSTALLATION_REPO_ID,
      driver,
      fetchContents,
    });

    expect(outcome).toEqual({
      status: "refused",
      reason: `repository ${OUTSIDE_INSTALLATION_REPO_ID} is not in installation 1`,
    });
    expect(fetchContents).not.toHaveBeenCalled();
  });
});
