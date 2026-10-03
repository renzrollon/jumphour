// Task 2.3: discovery_reports.status is restricted to the three
// GitHub-canonical values by a schema CHECK constraint (migration
// 0002_discovery_report_status_check.sql) — see
// openspec/changes/github-app-and-openspec-discovery/tasks.md and
// specs/openspec-discovery/spec.md "Classify OpenSpec support status".
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";
import { getDiscoveryReport, listDiscoveryReports, upsertDiscoveryReport } from "./discovery-reports";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "migrations",
);

let driver: SqlDriver;
let nextRepoId = 1;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [1, 100, "acme", now, now],
  );
  nextRepoId = 1;
});

afterEach(() => {
  driver.close();
});

function insertReport(status: string): void {
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO discovery_reports (installation_id, github_repo_id, status, observed_at)
     VALUES (?, ?, ?, ?)`,
    [1, nextRepoId++, status, now],
  );
}

describe("discovery_reports.status is constrained to the canonical values", () => {
  it.each(["supported", "unsupported", "permission-blocked"])(
    "accepts the canonical value %s",
    (status) => {
      expect(() => insertReport(status)).not.toThrow();
    },
  );

  it.each(["Supported", "unknown", "", "pending", "permission_blocked"])(
    "rejects the invalid status value %j",
    (status) => {
      expect(() => insertReport(status)).toThrow();
    },
  );

  it("still enforces uniqueness of (installation_id, github_repo_id) after the migration 0002 table rebuild", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO discovery_reports (installation_id, github_repo_id, status, observed_at)
       VALUES (?, ?, ?, ?)`,
      [1, 42, "supported", now],
    );

    expect(() =>
      driver.run(
        `INSERT INTO discovery_reports (installation_id, github_repo_id, status, observed_at)
         VALUES (?, ?, ?, ?)`,
        [1, 42, "unsupported", now],
      ),
    ).toThrow();
  });
});

// Task 6.6: design.md Decision 6 ("on refresh, overwrite the report") and
// specs/openspec-discovery/spec.md "Scope discovery reports to the
// installation" — the write path built on the (installation_id,
// github_repo_id) primary key set by migration 0001/0002.
describe("upsertDiscoveryReport", () => {
  it("inserts a new report for (installation_id, github_repo_id)", () => {
    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
    });

    const row = driver.get<{
      status: string;
      default_branch: string;
      tip_sha: string;
      config_path: string;
      schema: string;
      reason: string | null;
    }>(
      `SELECT status, default_branch, tip_sha, config_path, schema, reason
       FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?`,
      [1, 42],
    );

    expect(row).toEqual({
      status: "supported",
      default_branch: "main",
      tip_sha: "abc123",
      config_path: "openspec/config.yaml",
      schema: "spec-driven",
      reason: null,
    });
  });

  it("a later refresh for the same (installation_id, github_repo_id) overwrites every column instead of inserting a second row", () => {
    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
    });

    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "unsupported",
      defaultBranch: "main",
      tipSha: "def456",
      reason: "openspec/changes/ was not found on main",
    });

    const rowCount = driver.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    )!.n;
    expect(rowCount).toBe(1);

    const row = driver.get<{
      status: string;
      tip_sha: string;
      config_path: string | null;
      schema: string | null;
      reason: string | null;
    }>(
      `SELECT status, tip_sha, config_path, schema, reason
       FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?`,
      [1, 42],
    );

    // The prior "supported" run's config_path/schema must not survive on an
    // "unsupported" refresh — GitHub's current read is authoritative, not a
    // merge with the cached row (design.md Decision 6).
    expect(row).toEqual({
      status: "unsupported",
      tip_sha: "def456",
      config_path: null,
      schema: null,
      reason: "openspec/changes/ was not found on main",
    });
  });

  it("keeps reports for different installations of the same github_repo_id as separate rows", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
    });
    upsertDiscoveryReport(driver, {
      installationId: 2,
      githubRepoId: 42,
      status: "unsupported",
      defaultBranch: "main",
      tipSha: "abc123",
      reason: "openspec/config.yaml was not found on main",
    });

    const total = driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM discovery_reports")!.n;
    expect(total).toBe(2);
  });

  it("rejects a status value outside the canonical set through the upsert path too", () => {
    expect(() =>
      upsertDiscoveryReport(driver, {
        installationId: 1,
        githubRepoId: 42,
        status: "pending",
        defaultBranch: "main",
        tipSha: "abc123",
      }),
    ).toThrow();
  });
});

// Task 7.1: specs/openspec-discovery/spec.md "Scope discovery reports to the
// installation" — "the system does not return installation A's report" when
// "an authorized user of installation B requests discovery for a repository
// GitHub also names acme/api-gateway", and "it runs or loads discovery in
// installation B's tenancy only".
describe("getDiscoveryReport", () => {
  it("returns the stored report for (installationId, githubRepoId)", () => {
    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
    });

    expect(getDiscoveryReport(driver, 1, 42)).toEqual({
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
      reason: null,
      observedAt: expect.any(String),
    });
  });

  it("returns undefined when no report is stored for that pair", () => {
    expect(getDiscoveryReport(driver, 1, 999)).toBeUndefined();
  });

  it("does not return installation A's report when queried under installation B, even for a GitHub repo id both installations name acme/api-gateway", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
    });

    // Installation B has never run discovery for github_repo_id 42.
    expect(getDiscoveryReport(driver, 2, 42)).toBeUndefined();
  });
});

describe("listDiscoveryReports", () => {
  it("lists only the reports stored for the given installation", () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 42,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
    });
    upsertDiscoveryReport(driver, {
      installationId: 1,
      githubRepoId: 43,
      status: "unsupported",
      defaultBranch: "main",
      tipSha: "def456",
      reason: "openspec/config.yaml was not found on main",
    });
    // Installation B's report for the same github_repo_id must not appear in
    // installation A's list.
    upsertDiscoveryReport(driver, {
      installationId: 2,
      githubRepoId: 42,
      status: "permission-blocked",
      defaultBranch: null,
      tipSha: null,
      reason: "GitHub returned 403 reading repository metadata",
    });

    const rowsForA = listDiscoveryReports(driver, 1);

    expect(rowsForA).toHaveLength(2);
    expect(rowsForA.every((row) => row.installationId === 1)).toBe(true);
    expect(rowsForA.map((row) => row.githubRepoId)).toEqual([42, 43]);
    expect(rowsForA.some((row) => row.status === "permission-blocked")).toBe(false);
  });

  it("returns an empty list for an installation with no stored reports", () => {
    expect(listDiscoveryReports(driver, 1)).toEqual([]);
  });
});
