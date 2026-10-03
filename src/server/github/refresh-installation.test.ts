// Task 8.4: "Wire Refresh to re-run listing and discovery for the current
// installation, and verify a changed GitHub `full_name` for the same repo id
// updates the existing row instead of inserting a duplicate."
//
// The rename case is the task's stated verification and
// specs/openspec-discovery/spec.md's "Edge case — renamed GitHub full_name
// keeps one identity". The newly-accessible-repository case is what
// re-listing (rather than re-resolving an already-known set) is FOR: it is
// the only thing that can observe the accessible set growing, and it is only
// reachable because ../../app/api/github/refresh/route.ts now goes through
// GitHub OAuth to obtain a user token first (design.md Decision 2).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { refreshInstallationFromGithub } from "./refresh-installation";
import { upsertInstallationRepository, listInstallationRepositories } from "../db/installation-repositories";
import { getDiscoveryReport } from "../db/discovery-reports";
import { GITHUB_ACCEPT_HEADER, GITHUB_API_VERSION, type GithubRequestFn } from "./request";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

const INSTALLATION_ID = 1;
const USER_TOKEN = "gho_fake_user_token";
const INSTALLATION_TOKEN = "ghs_fake_installation_token";

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
    [INSTALLATION_ID, 100, "acme", now, now],
  );
});

afterEach(() => {
  driver.close();
});

interface FixtureOptions {
  /** What the listing call reports, i.e. GitHub's current truth. */
  listed: Array<{ id: number; full_name: string }>;
  /** Records every (route, authorization header) pair, when supplied. */
  authLog?: Array<{ route: string; authorization: string }>;
}

function githubFixture(options: FixtureOptions): GithubRequestFn {
  return async (route, requestParams) => {
    const headers = (requestParams as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    options.authLog?.push({ route, authorization: headers.authorization ?? "" });

    if (route === "GET /user/installations/{installation_id}/repositories") {
      return { data: { repositories: options.listed } };
    }
    if (route === "GET /repos/{owner}/{repo}") {
      return { data: { default_branch: "main" } };
    }
    if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
      return { data: { object: { sha: "abc123" } } };
    }
    const filePath = (requestParams as { path?: string } | undefined)?.path;
    if (route === "GET /repos/{owner}/{repo}/contents/{path}" && filePath === "openspec/config.yaml") {
      return { data: { content: base64("schema: spec-driven\n") } };
    }
    if (route === "GET /repos/{owner}/{repo}/contents/{path}" && filePath === "openspec/changes") {
      return { data: [{ name: "add-feature", type: "dir" }] };
    }
    throw new Error(`unexpected route in test fixture: ${route} path=${String(filePath)}`);
  };
}

function rowCountFor(githubRepoId: number): number {
  return driver.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
    [INSTALLATION_ID, githubRepoId],
  )!.n;
}

describe("refreshInstallationFromGithub", () => {
  it("updates the existing row's full_name in place instead of inserting a duplicate when GitHub reports a rename", async () => {
    upsertInstallationRepository(driver, {
      installationId: INSTALLATION_ID,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });

    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      // Same repository id, new canonical name.
      request: githubFixture({ listed: [{ id: 42, full_name: "acme/api-platform" }] }),
    });

    expect(outcome.status).toBe("ok");

    // One identity, not two.
    expect(rowCountFor(42)).toBe(1);
    const stored = listInstallationRepositories(driver, INSTALLATION_ID);
    expect(stored).toEqual([
      { installationId: INSTALLATION_ID, githubRepoId: 42, fullName: "acme/api-platform" },
    ]);
  });

  it("re-runs discovery for each listed repository and stores the report", async () => {
    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request: githubFixture({ listed: [{ id: 42, full_name: "acme/api-gateway" }] }),
    });

    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.reports).toHaveLength(1);
    expect(outcome.reports[0]).toMatchObject({ githubRepoId: 42 });
    expect(outcome.reports[0].report.status).toBe("supported");

    const report = getDiscoveryReport(driver, INSTALLATION_ID, 42);
    expect(report?.status).toBe("supported");
  });

  it("discovers a repository the user has only just been granted access to", async () => {
    // Only 42 is known locally; GitHub now reports a second repository.
    upsertInstallationRepository(driver, {
      installationId: INSTALLATION_ID,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });

    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request: githubFixture({
        listed: [
          { id: 42, full_name: "acme/api-gateway" },
          { id: 77, full_name: "acme/customer-web" },
        ],
      }),
    });

    expect(outcome.status).toBe("ok");
    expect(listInstallationRepositories(driver, INSTALLATION_ID)).toEqual([
      { installationId: INSTALLATION_ID, githubRepoId: 42, fullName: "acme/api-gateway" },
      { installationId: INSTALLATION_ID, githubRepoId: 77, fullName: "acme/customer-web" },
    ]);
    // The newly accessible repository was discovered, not just recorded.
    expect(getDiscoveryReport(driver, INSTALLATION_ID, 77)?.status).toBe("supported");
  });

  it("uses the user token for listing and the installation token for discovery (design.md Decision 2)", async () => {
    const authLog: Array<{ route: string; authorization: string }> = [];

    await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request: githubFixture({ listed: [{ id: 42, full_name: "acme/api-gateway" }], authLog }),
    });

    const listing = authLog.filter((c) => c.route.startsWith("GET /user/installations"));
    const discovery = authLog.filter((c) => c.route.startsWith("GET /repos"));

    expect(listing).toHaveLength(1);
    expect(listing[0].authorization).toBe(`Bearer ${USER_TOKEN}`);

    expect(discovery.length).toBeGreaterThan(0);
    for (const call of discovery) {
      // Never the user's token: an installation token would also be wrong on
      // the listing call, and vice versa.
      expect(call.authorization).toBe(`Bearer ${INSTALLATION_TOKEN}`);
    }
  });

  it("sends the required GitHub API headers on every call", async () => {
    const seen: Array<Record<string, string>> = [];
    const request: GithubRequestFn = async (route, requestParams) => {
      seen.push(((requestParams as { headers?: Record<string, string> })?.headers ?? {}) as Record<string, string>);
      return githubFixture({ listed: [{ id: 42, full_name: "acme/api-gateway" }] })(route, requestParams);
    };

    await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request,
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const headers of seen) {
      expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
      expect(headers["x-github-api-version"]).toBe(GITHUB_API_VERSION);
    }
  });

  it("persists nothing and runs no discovery when the listing call fails", async () => {
    upsertInstallationRepository(driver, {
      installationId: INSTALLATION_ID,
      githubRepoId: 42,
      fullName: "acme/api-gateway",
    });

    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request: async (route) => {
        if (route === "GET /user/installations/{installation_id}/repositories") {
          throw new Error("GitHub listing unavailable");
        }
        throw new Error(`discovery must not run after a failed listing: ${route}`);
      },
    });

    expect(outcome).toEqual({ status: "failed", retryable: true, repositories: [], reports: [] });
    // The stale row survives untouched — a failed refresh invents nothing
    // and deletes nothing (task 4.3's contract).
    expect(listInstallationRepositories(driver, INSTALLATION_ID)).toEqual([
      { installationId: INSTALLATION_ID, githubRepoId: 42, fullName: "acme/api-gateway" },
    ]);
    expect(getDiscoveryReport(driver, INSTALLATION_ID, 42)).toBeUndefined();
  });

  it("is a no-op when the installation has no accessible repositories", async () => {
    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: USER_TOKEN,
      installationToken: INSTALLATION_TOKEN,
      request: githubFixture({ listed: [] }),
    });

    expect(outcome).toMatchObject({ status: "ok", repositories: [], reports: [] });
    expect(listInstallationRepositories(driver, INSTALLATION_ID)).toEqual([]);
  });
});
