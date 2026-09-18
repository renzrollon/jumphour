// Task 4.3: specs/github-app-installation/spec.md "Failure — GitHub listing
// is unavailable". The failure case is proven against a real (in-memory)
// driver, the same way ./recover-installations.test.ts proves task 3.3,
// so "does not persist invented repositories" is an actual row count, not a
// mocked write-call assertion.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { syncAccessibleRepositories } from "./sync-accessible-repositories";
import type { GithubInstallationRepository } from "./oauth";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [1, 100, "acme", now, now],
  );
});

afterEach(() => {
  driver.close();
});

function countRepositoryRows(): number {
  return driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM installation_repositories")!.n;
}

describe("syncAccessibleRepositories", () => {
  it("persists the GitHub-canonical list on success", async () => {
    const repositories: GithubInstallationRepository[] = [{ githubRepoId: 1, fullName: "acme/api-gateway" }];

    const outcome = await syncAccessibleRepositories({
      installationId: 1,
      driver,
      fetchRepositories: async () => repositories,
    });

    expect(outcome).toEqual({ status: "ok", repositories });
    expect(countRepositoryRows()).toBe(1);
  });

  it("returns a retryable failure and persists nothing when GitHub listing fails", async () => {
    const outcome = await syncAccessibleRepositories({
      installationId: 1,
      driver,
      fetchRepositories: async () => {
        throw new Error("GitHub API rate limited");
      },
    });

    expect(outcome).toEqual({ status: "failed", retryable: true, repositories: [] });
    expect(countRepositoryRows()).toBe(0);
  });

  it("leaves a prior successful list untouched (no invented rows) when a later sync fails", async () => {
    await syncAccessibleRepositories({
      installationId: 1,
      driver,
      fetchRepositories: async () => [{ githubRepoId: 1, fullName: "acme/api-gateway" }],
    });

    const outcome = await syncAccessibleRepositories({
      installationId: 1,
      driver,
      fetchRepositories: async () => {
        throw new Error("network error");
      },
    });

    expect(outcome).toEqual({ status: "failed", retryable: true, repositories: [] });
    expect(countRepositoryRows()).toBe(1);
    const row = driver.get<{ full_name: string }>(
      "SELECT full_name FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
      [1, 1],
    );
    expect(row?.full_name).toBe("acme/api-gateway");
  });
});
