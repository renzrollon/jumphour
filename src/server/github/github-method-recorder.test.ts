// Task 5.3: specs/github-app-installation/spec.md "Fail closed when required
// GitHub permissions are missing" — "Happy path — required permissions are
// present": "the system proceeds with read-only GitHub operations AND it does
// not create a branch, commit, file, or pull request."
//
// Two halves, deliberately:
//
//   1. The harness must be able to FAIL. A no-write assertion that cannot
//      detect a write is a green test proving nothing, so the first describe
//      block feeds the recorder known-bad traffic (a POST to a pulls path, a
//      PUT to contents, a DELETE to git) and asserts it names each one.
//   2. The harness is then pointed at the REAL list and discovery paths —
//      syncAccessibleRepositories over task 4.1's
//      fetchUserInstallationRepositories, and task 6.6's runOpenSpecDiscovery
//      over task 6.1's classifyOpenSpecSupport — with GitHub replaced only at
//      the ./request.ts seam. Nothing about the code under test is stubbed
//      out, so the recorded methods are the methods those paths really issue.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import {
  GITHUB_WRITE_METHODS,
  isWriteMethod,
  parseGithubRoute,
  protectedPathFamily,
  recordGithubMethods,
} from "./github-method-recorder";
import { fetchUserInstallationRepositories } from "./oauth";
import { syncAccessibleRepositories } from "./sync-accessible-repositories";
import { runOpenSpecDiscovery } from "./run-openspec-discovery";
import { refreshInstallationFromGithub } from "./refresh-installation";
import type { GithubRequestFn } from "./request";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

const INSTALLATION_ID = 1;
const REPO_ID = 42;

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

/** Answers exactly the calls the real list + discovery paths issue for one
 * "supported" repository. Any other route throws, so a code path that starts
 * calling something new fails here rather than being silently recorded. */
function githubFixture(): GithubRequestFn {
  return async (route, requestParams) => {
    if (route === "GET /user/installations/{installation_id}/repositories") {
      return { data: { repositories: [{ id: REPO_ID, full_name: "acme/api-gateway" }] } };
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

describe("parseGithubRoute", () => {
  it("splits a route into its method and path", () => {
    expect(parseGithubRoute("GET /repos/{owner}/{repo}")).toEqual({
      method: "GET",
      path: "/repos/{owner}/{repo}",
    });
    expect(parseGithubRoute("POST /repos/{owner}/{repo}/pulls")).toEqual({
      method: "POST",
      path: "/repos/{owner}/{repo}/pulls",
    });
  });

  it("treats a bare path as GET, matching Octokit's own default", () => {
    expect(parseGithubRoute("/user/installations")).toEqual({
      method: "GET",
      path: "/user/installations",
    });
  });

  it("does not treat an unrecognized leading token as a read", () => {
    const parsed = parseGithubRoute("FROB /repos/{owner}/{repo}");
    expect(parsed.method).toBe("FROB");
    expect(isWriteMethod(parsed.method)).toBe(true);
  });
});

describe("protectedPathFamily", () => {
  it("names the repo, git, contents and pull-request families the task forbids writing to", () => {
    expect(protectedPathFamily("/repos/{owner}/{repo}/contents/{path}")).toBe("contents");
    expect(protectedPathFamily("/repos/{owner}/{repo}/git/refs")).toBe("git");
    expect(protectedPathFamily("/repos/{owner}/{repo}/pulls")).toBe("pull-request");
    expect(protectedPathFamily("/repos/{owner}/{repo}")).toBe("repo");
  });

  it("leaves non-repository paths unclassified", () => {
    expect(protectedPathFamily("/user/installations/{installation_id}/repositories")).toBeNull();
    expect(protectedPathFamily("/app/installations/{installation_id}")).toBeNull();
  });
});

// The harness must be able to fail, or the no-write assertion below is
// vacuous. Every one of these drives known-bad traffic through it.
describe("recordGithubMethods — catches writes it is pointed at", () => {
  it.each(GITHUB_WRITE_METHODS)("flags a %s against a protected path", async (method) => {
    const recorder = recordGithubMethods(async () => ({ data: {} }));
    await recorder.request(`${method} /repos/{owner}/{repo}/pulls`);

    expect(recorder.protectedWrites()).toHaveLength(1);
    expect(recorder.protectedWrites()[0]).toMatchObject({ method, family: "pull-request" });
    expect(() => recorder.assertNoGithubWrites()).toThrow(/zero GitHub writes/);
  });

  it("names the offending method, path and family in the failure message", async () => {
    const recorder = recordGithubMethods(async () => ({ data: {} }));
    await recorder.request("PUT /repos/{owner}/{repo}/contents/{path}");

    expect(() => recorder.assertNoGithubWrites()).toThrow(
      /PUT \/repos\/\{owner\}\/\{repo\}\/contents\/\{path\} \(contents path\)/,
    );
  });

  it("records an attempted write even when GitHub refuses it", async () => {
    const recorder = recordGithubMethods(async () => {
      throw new Error("403 Forbidden");
    });

    await expect(recorder.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}")).rejects.toThrow(
      "403 Forbidden",
    );

    // The attempt is what the spec forbids — a refused write is still a write
    // this change tried to make.
    expect(recorder.protectedWrites()).toHaveLength(1);
    expect(recorder.calls[0]).toMatchObject({ method: "DELETE", family: "git", failed: true });
    expect(() => recorder.assertNoGithubWrites()).toThrow();
  });

  it("stays silent on reads", async () => {
    const recorder = recordGithubMethods(async () => ({ data: {} }));
    await recorder.request("GET /repos/{owner}/{repo}/pulls");

    expect(recorder.writes()).toEqual([]);
    expect(() => recorder.assertNoGithubWrites()).not.toThrow();
  });
});

describe("list + discovery issue no GitHub writes", () => {
  it("records every HTTP method used across listing and discovery, and none is a write", async () => {
    const recorder = recordGithubMethods(githubFixture());

    // The real listing path (task 4.1 wrapped by task 4.3).
    const listed = await syncAccessibleRepositories({
      installationId: INSTALLATION_ID,
      driver,
      fetchRepositories: () =>
        fetchUserInstallationRepositories({
          accessToken: "gho_fake_user_token",
          installationId: INSTALLATION_ID,
          request: recorder.request,
        }),
    });

    expect(listed.status).toBe("ok");
    expect(listed.repositories).toEqual([{ githubRepoId: REPO_ID, fullName: "acme/api-gateway" }]);

    // The real discovery path (task 6.1 wrapped by task 6.6).
    const report = await runOpenSpecDiscovery({
      installationId: INSTALLATION_ID,
      githubRepoId: REPO_ID,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake_installation_token",
      request: recorder.request,
    });

    expect(report.status).toBe("supported");

    // Non-vacuous: the recorder really did observe both paths' traffic.
    expect(recorder.calls.length).toBeGreaterThanOrEqual(5);
    expect(recorder.calls.map((call) => call.route)).toEqual([
      "GET /user/installations/{installation_id}/repositories",
      "GET /repos/{owner}/{repo}",
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      "GET /repos/{owner}/{repo}/contents/{path}",
      "GET /repos/{owner}/{repo}/contents/{path}",
    ]);

    // The assertion the spec scenario states.
    expect(recorder.methods()).toEqual(["GET"]);
    expect(recorder.writes()).toEqual([]);
    expect(recorder.protectedWrites()).toEqual([]);
    expect(() => recorder.assertNoGithubWrites()).not.toThrow();
  });

  it("issues no write across a whole Refresh — the real list-then-discover path", async () => {
    const recorder = recordGithubMethods(githubFixture());

    // Task 8.4's Refresh, end to end: listing with the user token, then
    // discovery with the installation token, over the same seam.
    const outcome = await refreshInstallationFromGithub({
      installationId: INSTALLATION_ID,
      driver,
      userAccessToken: "gho_fake_user_token",
      installationToken: "ghs_fake_installation_token",
      request: recorder.request,
    });

    expect(outcome.status).toBe("ok");
    expect(recorder.calls.length).toBeGreaterThanOrEqual(5);
    expect(recorder.methods()).toEqual(["GET"]);
    expect(recorder.protectedWrites()).toEqual([]);
    expect(() => recorder.assertNoGithubWrites()).not.toThrow();
  });

  it("issues no write when discovery is repeated for the same repository", async () => {
    const recorder = recordGithubMethods(githubFixture());
    const discover = () =>
      runOpenSpecDiscovery({
        installationId: INSTALLATION_ID,
        githubRepoId: REPO_ID,
        driver,
        owner: "acme",
        repo: "api-gateway",
        installationToken: "ghs_fake_installation_token",
        request: recorder.request,
      });

    await Promise.all([discover(), discover()]);

    expect(recorder.methods()).toEqual(["GET"]);
    expect(() => recorder.assertNoGithubWrites()).not.toThrow();
  });

  it("issues no write when GitHub refuses the reads (permission-blocked)", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
    const recorder = recordGithubMethods(async () => {
      throw forbidden;
    });

    const report = await runOpenSpecDiscovery({
      installationId: INSTALLATION_ID,
      githubRepoId: REPO_ID,
      driver,
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake_installation_token",
      request: recorder.request,
    });

    // No compensating write is attempted when a permission is missing —
    // spec: "it does not attempt a GitHub write to compensate".
    expect(report.status).toBe("permission-blocked");
    expect(recorder.methods()).toEqual(["GET"]);
    expect(() => recorder.assertNoGithubWrites()).not.toThrow();
  });
});
