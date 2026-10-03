// Task 4.3: specs/github-app-installation/spec.md "Failure — GitHub listing
// is unavailable": "the system does not invent a repository list" AND "it
// shows that GitHub repository listing failed and can be retried."
//
// Wraps task 4.1's fetchUserInstallationRepositories (injected as
// `fetchRepositories`, same seam pattern as ./recover-installations.ts's
// `listInstallations`) so a GitHub failure never reaches the caller as an
// unhandled rejection and never falls back to a guessed/stale list. On
// success, the GitHub-canonical rows are persisted via task 2.2's
// upsertInstallationRepository (rename-safe: same github_repo_id updates
// full_name in place). On failure, persistence is never attempted — no row
// is written, invented, or left over from a prior guess — and the outcome
// carries `retryable: true` for the UI to offer a retry (design.md Decision
// 8: "retry/refresh").
import { upsertInstallationRepository } from "../db/installation-repositories";
import type { SqlDriver } from "../db/types";
import type { GithubInstallationRepository } from "./oauth";

export interface FetchInstallationRepositoriesFn {
  (): Promise<GithubInstallationRepository[]>;
}

export interface SyncAccessibleRepositoriesParams {
  installationId: number;
  driver: SqlDriver;
  /** Test seam: production wires this to
   * `() => fetchUserInstallationRepositories({ accessToken, installationId, request })`. */
  fetchRepositories: FetchInstallationRepositoriesFn;
}

export type SyncAccessibleRepositoriesOutcome =
  | { status: "ok"; repositories: GithubInstallationRepository[] }
  | { status: "failed"; retryable: true; repositories: [] };

/**
 * Lists the installation's user-accessible repositories via
 * `fetchRepositories` and persists them. When the GitHub call fails, returns
 * a retryable failure and an empty list instead of throwing or persisting
 * anything — see ./sync-accessible-repositories.test.ts's failure case,
 * which asserts zero rows land in `installation_repositories`.
 */
export async function syncAccessibleRepositories(
  params: SyncAccessibleRepositoriesParams,
): Promise<SyncAccessibleRepositoriesOutcome> {
  let repositories: GithubInstallationRepository[];
  try {
    repositories = await params.fetchRepositories();
  } catch {
    return { status: "failed", retryable: true, repositories: [] };
  }

  for (const repository of repositories) {
    upsertInstallationRepository(params.driver, {
      installationId: params.installationId,
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
    });
  }

  return { status: "ok", repositories };
}
