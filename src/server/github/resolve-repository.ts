// Task 4.2: resolve a user-typed `owner/name` string against the
// GitHub-canonical repository list, rather than comparing raw strings.
// design.md Decision 4 ("Canonical identities"): "User-typed owner/name is
// input, not identity. Resolve through GitHub (or a stored row keyed by
// github_repo_id) before compare. Mixed-case Acme/API-Gateway and
// acme/api-gateway MUST become one github_repo_id. Do not === raw strings in
// UI, cache keys, or SQL besides looking up the stored canonical full_name
// after GitHub resolution."
//
// The list passed in here is always a GitHub-resolved list — task 4.1's
// fetchUserInstallationRepositories() output, or the same shape read back
// from the installation_repositories table (task 2.2) — never a second,
// independent GitHub lookup keyed off the user's raw input. Comparing
// case-insensitively against that already-canonical list is what "resolve
// through GitHub before compare" means here: the canonical form returned is
// GitHub's own `full_name`/`id`, not whatever casing the user typed.
import type { GithubInstallationRepository } from "./oauth";

export interface ResolveRepositoryByOwnerNameParams {
  /** GitHub-canonical repositories already resolved through GitHub (task
   * 4.1's output, or a stored row read back by github_repo_id). */
  repositories: readonly GithubInstallationRepository[];
  /** Raw user-typed `owner/name`, in whatever case the user entered it. */
  ownerName: string;
}

export type ResolveRepositoryOutcome =
  | { resolved: true; repository: GithubInstallationRepository }
  | { resolved: false };

/**
 * Matches `ownerName` against `repositories` by case-insensitive comparison
 * of GitHub's canonical `full_name`, returning the canonical entry (its own
 * `githubRepoId` + `fullName`, not the user's typed casing) on a match.
 * `Acme/API-Gateway` and `acme/api-gateway` both resolve to the same
 * `githubRepoId` when the canonical list contains `acme/api-gateway` once —
 * see ./resolve-repository.test.ts.
 */
export function resolveRepositoryByOwnerName(
  params: ResolveRepositoryByOwnerNameParams,
): ResolveRepositoryOutcome {
  const needle = params.ownerName.trim().toLowerCase();

  const repository = params.repositories.find(
    (candidate) => candidate.fullName.toLowerCase() === needle,
  );

  return repository ? { resolved: true, repository } : { resolved: false };
}
