// Task 6.6: specs/openspec-discovery/spec.md "Edge case — concurrent
// discovery runs do not write" — two discovery runs for the same repository
// overlapping in time report the same canonical support status, and neither
// writes to GitHub. Also proves design.md Decision 6's "Cache reports per
// (installation_id, github_repo_id) ... on refresh, overwrite the report":
// the stored row is refreshed in place across repeated runs, never
// duplicated.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { runOpenSpecDiscovery } from "./run-openspec-discovery";
import { getDiscoveryReport } from "../db/discovery-reports";
import type { GithubRequestFn } from "./request";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

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

function rowCountFor(installationId: number, githubRepoId: number): number {
  return driver.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?",
    [installationId, githubRepoId],
  )!.n;
}

/** A "supported" fixture (same shape as classify-openspec-support.test.ts's
 * happyPathRequest), instrumented to record every route it answers so a
 * test can assert none of them was a GitHub write. */
function supportedFixture(calls: string[]): GithubRequestFn {
  return async (route, requestParams) => {
    calls.push(route);
    if (route === "GET /repos/{owner}/{repo}") {
      return { data: { default_branch: "main" } };
    }
    if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
      return { data: { object: { sha: "abc123" } } };
    }
    const path = (requestParams as { path?: string } | undefined)?.path;
    if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
      return { data: { content: base64("schema: spec-driven\n") } };
    }
    if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/changes") {
      return { data: [{ name: "add-feature", type: "dir" }] };
    }
    throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
  };
}

describe("runOpenSpecDiscovery", () => {
  it("persists the classified report under (installation_id, github_repo_id)", async () => {
    const report = await runOpenSpecDiscovery({
      installationId: 1,
      githubRepoId: 42,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: supportedFixture([]),
    });

    expect(report.status).toBe("supported");
    expect(rowCountFor(1, 42)).toBe(1);
    const row = driver.get<{ status: string }>(
      "SELECT status FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    );
    expect(row?.status).toBe("supported");
  });

  it("two discovery runs for the same fixture emit the same canonical status, leave one stored report (not two), and issue no GitHub write", async () => {
    const callsA: string[] = [];
    const callsB: string[] = [];

    const [reportA, reportB] = await Promise.all([
      runOpenSpecDiscovery({
        installationId: 1,
        githubRepoId: 42,
        driver,
        owner: "acme",
        repo: "api-gateway",
        installationToken: "ghs_fake",
        request: supportedFixture(callsA),
      }),
      runOpenSpecDiscovery({
        installationId: 1,
        githubRepoId: 42,
        driver,
        owner: "acme",
        repo: "api-gateway",
        installationToken: "ghs_fake",
        request: supportedFixture(callsB),
      }),
    ]);

    expect(reportA.status).toBe("supported");
    expect(reportA.status).toBe(reportB.status);
    expect(rowCountFor(1, 42)).toBe(1);

    // Each fixture throws on any route it wasn't told to expect, so both
    // calls completing already proves neither run wrote anything; assert it
    // explicitly too (CLAUDE.md "GitHub access": zero writes).
    expect(callsA.length).toBeGreaterThan(0);
    expect(callsB.length).toBeGreaterThan(0);
    for (const route of [...callsA, ...callsB]) {
      expect(route.startsWith("GET ")).toBe(true);
    }
  });

  it("a later run overwrites the earlier stored report in place instead of adding a second row", async () => {
    await runOpenSpecDiscovery({
      installationId: 1,
      githubRepoId: 42,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: supportedFixture([]),
    });

    const unsupportedRequest: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "def456" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        const error = new Error("Not Found") as Error & { status: number };
        error.status = 404;
        throw error;
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const report = await runOpenSpecDiscovery({
      installationId: 1,
      githubRepoId: 42,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: unsupportedRequest,
    });

    expect(report.status).toBe("unsupported");
    expect(rowCountFor(1, 42)).toBe(1);

    const row = driver.get<{ status: string; config_path: string | null; schema: string | null }>(
      "SELECT status, config_path, schema FROM discovery_reports WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    );
    expect(row).toEqual({ status: "unsupported", config_path: null, schema: null });
  });
});

// Task 7.3: specs/openspec-discovery/spec.md "Failure — report from another
// installation is not reused": "the system does not return installation
// A's report" for "an authorized user of installation B", "AND it runs or
// loads discovery in installation B's tenancy only." This exercises the
// full runOpenSpecDiscovery -> getDiscoveryReport path across two
// installations for the same numeric github_repo_id — task 7.1 already
// proved the raw SQL read is scoped; this proves discovery runs and reads
// compose to the same isolation, with neither installation's run touching
// the other's stored row.
describe("cross-installation isolation of discovery reports", () => {
  it("a report stored under installation A for a github_repo_id is not returned under installation B, which has no report of its own yet", async () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    await runOpenSpecDiscovery({
      installationId: 1,
      githubRepoId: 42,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: supportedFixture([]),
    });

    // Installation B has never run discovery for the same numeric
    // github_repo_id: no report, not A's.
    expect(getDiscoveryReport(driver, 2, 42)).toBeUndefined();
  });

  it("running discovery under installation B for the same github_repo_id A already has a report for produces B's own independent report, leaving A's untouched", async () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [2, 200, "other-org", now, now],
    );

    await runOpenSpecDiscovery({
      installationId: 1,
      githubRepoId: 42,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: supportedFixture([]),
    });

    const unsupportedRequest: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "ghi789" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        const error = new Error("Not Found") as Error & { status: number };
        error.status = 404;
        throw error;
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const reportB = await runOpenSpecDiscovery({
      installationId: 2,
      githubRepoId: 42,
      driver,
      owner: "other-org",
      repo: "public-tools",
      installationToken: "ghs_fake",
      request: unsupportedRequest,
    });

    expect(reportB.status).toBe("unsupported");

    // B's own read reflects B's own run — not A's "supported" report.
    expect(getDiscoveryReport(driver, 2, 42)?.status).toBe("unsupported");
    // A's report is unaffected by B's run: still "supported", still one row.
    expect(getDiscoveryReport(driver, 1, 42)?.status).toBe("supported");
    expect(rowCountFor(1, 42)).toBe(1);
    expect(rowCountFor(2, 42)).toBe(1);
  });
});
