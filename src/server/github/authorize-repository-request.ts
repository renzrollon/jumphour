// Task 4.4: specs/github-app-installation/spec.md "Edge case — repository
// outside the installation": an installation that includes
// `acme/api-gateway` and does not include `acme/secret-ledger`; a request
// for `acme/secret-ledger` must be refused, and the system must not read
// that repository through the App.
//
// Authorization is checked against the stored `installation_repositories`
// table (task 2.2's upsert target, populated by task 4.3's sync) — the
// installation-scoped set Jumphour already knows about — never by calling
// GitHub to find out. `handleRepositoryContentsRequest` wraps an injected
// content-reading function (task 6.x's discovery content reads, in
// production) so an unauthorized request short-circuits before that
// function is ever invoked: see ./authorize-repository-request.test.ts,
// which asserts the injected GitHub call is not called for the
// out-of-installation repo.
import type { SqlDriver } from "../db/types";

export interface AuthorizeRepositoryRequestParams {
  installationId: number;
  githubRepoId: number;
  driver: SqlDriver;
}

export type AuthorizeRepositoryRequestOutcome =
  | { authorized: true }
  | { authorized: false; reason: string };

/**
 * Refuses a request for a `githubRepoId` that is not a row in
 * `installation_repositories` under `installationId` — the current
 * installation's known-accessible set. Never calls GitHub.
 */
export function authorizeRepositoryRequest(
  params: AuthorizeRepositoryRequestParams,
): AuthorizeRepositoryRequestOutcome {
  const row = params.driver.get(
    "SELECT github_repo_id FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
    [params.installationId, params.githubRepoId],
  );

  if (!row) {
    return {
      authorized: false,
      reason: `repository ${params.githubRepoId} is not in installation ${params.installationId}`,
    };
  }

  return { authorized: true };
}

export interface FetchRepositoryContentsFn {
  (githubRepoId: number): Promise<unknown>;
}

export interface HandleRepositoryContentsRequestParams {
  installationId: number;
  githubRepoId: number;
  driver: SqlDriver;
  /** Test seam: production wires this to a GitHub contents read (task 6.x).
   * Must never be called for a repository outside the current installation. */
  fetchContents: FetchRepositoryContentsFn;
}

export type HandleRepositoryContentsRequestOutcome =
  | { status: "ok"; data: unknown }
  | { status: "refused"; reason: string };

/**
 * Authorizes the request via `authorizeRepositoryRequest` before calling
 * `fetchContents`. A repository outside the current installation is refused
 * without `fetchContents` ever running, so no GitHub contents call is issued
 * for it.
 */
export async function handleRepositoryContentsRequest(
  params: HandleRepositoryContentsRequestParams,
): Promise<HandleRepositoryContentsRequestOutcome> {
  const authorization = authorizeRepositoryRequest({
    installationId: params.installationId,
    githubRepoId: params.githubRepoId,
    driver: params.driver,
  });

  if (!authorization.authorized) {
    return { status: "refused", reason: authorization.reason };
  }

  const data = await params.fetchContents(params.githubRepoId);
  return { status: "ok", data };
}
