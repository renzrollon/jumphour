// Task 2.2: unique `(installation_id, github_repo_id)` and the upsert write
// path built on it — inserting the same GitHub repo id twice must update
// `full_name` instead of creating a second row. See
// openspec/changes/github-app-and-openspec-discovery/tasks.md and
// specs/openspec-discovery/spec.md "renamed GitHub full_name keeps one
// identity".
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";
import { listInstallationRepositories, upsertInstallationRepository } from "./installation-repositories";

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

describe("installation_repositories uniqueness and upsert", () => {
  it("rejects a second row with the same (installation_id, github_repo_id) at the schema level", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installation_repositories (installation_id, github_repo_id, full_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [1, 42, "acme/api-gateway", now, now],
    );

    expect(() =>
      driver.run(
        `INSERT INTO installation_repositories (installation_id, github_repo_id, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [1, 42, "acme/api-gateway", now, now],
      ),
    ).toThrow();
  });

  it("upsertInstallationRepository inserts a new repository once", () => {
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });

    expect(countRepositoryRows()).toBe(1);
    const row = driver.get<{ full_name: string }>(
      "SELECT full_name FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    );
    expect(row?.full_name).toBe("acme/api-gateway");
  });

  it("inserting the same GitHub repo id twice updates full_name instead of creating a second row", () => {
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/api-gateway-renamed",
    });

    expect(countRepositoryRows()).toBe(1);
    const row = driver.get<{ full_name: string }>(
      "SELECT full_name FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    );
    expect(row?.full_name).toBe("acme/api-gateway-renamed");
  });

  it("keeps repositories under different installations as separate rows even with the same repo id", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });
    upsertInstallationRepository(driver, {
      installationId: 2,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });

    expect(countRepositoryRows()).toBe(2);
  });
});

// Task 7.1: specs/github-app-installation/spec.md "Isolate data by GitHub
// App installation" — "a signed-in user whose current context is
// installation A" requesting repository records "that belong to installation
// B" must be refused installation B's "repository names ... or identifiers".
// listInstallationRepositories is the query a repository-list screen (task
// 8.1) would call with the signed-in user's current installation id; this
// proves it structurally cannot return another installation's rows.
describe("listInstallationRepositories", () => {
  it("lists only the repositories stored for the given installation", () => {
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 43,
      fullName: "acme/billing",
    });

    const rows = listInstallationRepositories(driver, 1);

    expect(rows).toEqual([
      { installationId: 1, githubRepoId: 42, fullName: "acme/api-gateway" },
      { installationId: 1, githubRepoId: 43, fullName: "acme/billing" },
    ]);
  });

  it("never returns another installation's repository names or ids, even for the same github_repo_id", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    // Installation A's private repository.
    upsertInstallationRepository(driver, {
      installationId: 1,
      githubRepoId: 42,
      fullName: "acme/secret-ledger",
    });
    // Installation B happens to have a repository with the same
    // github_repo_id under a different name (distinct GitHub install).
    upsertInstallationRepository(driver, {
      installationId: 2,
      githubRepoId: 42,
      fullName: "other-org/public-tools",
    });

    const rowsForB = listInstallationRepositories(driver, 2);

    expect(rowsForB).toEqual([{ installationId: 2, githubRepoId: 42, fullName: "other-org/public-tools" }]);
    expect(rowsForB.some((row) => row.fullName === "acme/secret-ledger")).toBe(false);
  });

  it("returns an empty list for an installation with no stored repositories", () => {
    expect(listInstallationRepositories(driver, 1)).toEqual([]);
  });
});
