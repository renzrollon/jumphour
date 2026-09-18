// Task 8.4: design.md Decision 8 ("retry/refresh") and Decision 6
// ("Refresh on explicit user refresh ... on refresh, overwrite the
// report"). This is what a Refresh actually does once the OAuth round trip
// in ./refresh-return-state.ts has produced a fresh user-to-server token:
//
//   1. RE-LIST — `GET /user/installations/{id}/repositories` through task
//      4.1's fetchUserInstallationRepositories, wrapped by task 4.3's
//      syncAccessibleRepositories so a GitHub failure yields a retryable
//      outcome and persists nothing rather than inventing or half-writing a
//      list. This is GitHub's own intersection of "repositories in the
//      installation" and "repositories this user can access" (design.md
//      Decision 2), so it is the only call that can observe a repository
//      being added to, or removed from, the user's accessible set.
//   2. RE-DISCOVER — task 6.6's runOpenSpecDiscovery for each listed
//      repository, which overwrites that repository's stored report.
//
// The two credentials are different and deliberately not interchangeable
// (design.md Decision 2): listing uses the USER token, discovery uses the
// INSTALLATION token. Passing the installation token to the listing call
// would show a user every private repository in the installation, including
// ones they cannot access — the exact failure Decision 2 exists to prevent.
//
// Rename safety, which is this task's stated verification: listing returns
// GitHub's canonical `full_name` for a durable `github_repo_id`, and task
// 2.2's upsertInstallationRepository (called by syncAccessibleRepositories)
// updates `full_name` in place for an id it already knows rather than
// inserting a second row. specs/openspec-discovery/spec.md "Edge case —
// renamed GitHub full_name keeps one identity": "it does not create a
// second repository record from the new name alone." See
// ./refresh-installation.test.ts, which drives a rename end to end.
//
// Every GitHub call made here is a GET; nothing writes to GitHub (CLAUDE.md
// "GitHub access"), which ./github-method-recorder.test.ts asserts against
// these same code paths.
import { syncAccessibleRepositories } from "./sync-accessible-repositories";
import { fetchUserInstallationRepositories, type GithubInstallationRepository } from "./oauth";
import { runOpenSpecDiscovery } from "./run-openspec-discovery";
import type { OpenSpecDiscoveryReport } from "./classify-openspec-support";
import type { SqlDriver } from "../db/types";
import { createOctokitRequest, type GithubRequestFn } from "./request";

export interface RefreshInstallationFromGithubParams {
  installationId: number;
  driver: SqlDriver;
  /** The signed-in user's own user-to-server token, freshly obtained by the
   * OAuth round trip — never persisted (design.md Decision 7). Used for the
   * listing call only. */
  userAccessToken: string;
  /** Installation access token (task 3.1's mintInstallationToken output).
   * Used for the discovery reads only. */
  installationToken: string;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

export type RefreshInstallationFromGithubOutcome =
  | {
      status: "ok";
      repositories: GithubInstallationRepository[];
      reports: Array<{ githubRepoId: number; report: OpenSpecDiscoveryReport }>;
    }
  | {
      /** The listing call failed. Nothing was persisted and no discovery ran
       * — a refresh that cannot re-list must not overwrite stored reports
       * using a stale repository set. `retryable` mirrors task 4.3's
       * contract so the surface can offer the same retry. */
      status: "failed";
      retryable: true;
      repositories: [];
      reports: [];
    };

/**
 * Re-lists the installation's user-accessible repositories and re-runs
 * OpenSpec discovery for each, overwriting both the stored
 * `installation_repositories` rows and the stored `discovery_reports` rows
 * in place.
 *
 * A repository that has disappeared from the user's accessible set is left
 * in the database rather than deleted: this change's spec covers what is
 * listed, not row lifecycle, and silently dropping stored discovery history
 * on one transient listing shape is a bigger decision than a refresh should
 * make on its own. It is simply no longer returned by this call.
 */
export async function refreshInstallationFromGithub(
  params: RefreshInstallationFromGithubParams,
): Promise<RefreshInstallationFromGithubOutcome> {
  const { installationId, driver, userAccessToken, installationToken } = params;
  const request = params.request ?? createOctokitRequest();

  const listed = await syncAccessibleRepositories({
    installationId,
    driver,
    fetchRepositories: () =>
      fetchUserInstallationRepositories({
        accessToken: userAccessToken,
        installationId,
        request,
      }),
  });

  if (listed.status === "failed") {
    return { status: "failed", retryable: true, repositories: [], reports: [] };
  }

  const reports: Array<{ githubRepoId: number; report: OpenSpecDiscoveryReport }> = [];

  for (const repository of listed.repositories) {
    const [owner, repo] = repository.fullName.split("/");

    const report = await runOpenSpecDiscovery({
      installationId,
      githubRepoId: repository.githubRepoId,
      driver,
      owner,
      repo,
      installationToken,
      request,
    });

    reports.push({ githubRepoId: repository.githubRepoId, report });
  }

  return { status: "ok", repositories: listed.repositories, reports };
}
