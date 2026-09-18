// Task 8.2: specs/github-app-installation/spec.md "Present a thin signed-in
// repository and discovery surface" -- Failure scenario "installation has no
// accessible repositories": "they see an empty repository list AND the copy
// explains App installation and GitHub access, not a missing board." Also
// the "Authenticate users with GitHub identity" requirement's "Edge case --
// GitHub user has no overlapping repository access": "the empty state
// explains that GitHub repository access, not a Jumphour role, is missing."
// design.md line 116: "Empty and error copy must distinguish: App not
// installed, user has no overlapping repos, ..."
//
// Two distinct empty states, both already distinguishable from data this
// codebase already has at render time -- no new GitHub call, no re-derived
// state:
//
//   1. No installation at all (`session.installationId` is still null --
//      task 3.4's oauth-session.ts always starts a session this way, and
//      nothing in this codebase yet auto-selects a sole installation). This
//      is the same "App is not installed" / zero-overlap case task 3.5's
//      ./signed-in-surface.ts already names and tests
//      (INSTALLATION_REQUIRED_EXPLANATION), reused here verbatim rather than
//      duplicating near-identical copy that could drift from it (design.md
//      line 127's "[UI recomputes support]" risk applies just as much to
//      duplicated empty-state copy as to duplicated status classification).
//
//   2. An installation *is* selected, but the joined repository/discovery
//      table (task 8.1's buildRepositoryTableRows) has zero rows -- this
//      installation's stored `installation_repositories` (task 7.1) has
//      nothing for this session's tenancy. That is a GitHub access gap (the
//      signed-in user's own accessible-repository intersection came back
//      empty, or no sync has run yet -- task 8.4's Refresh is the only
//      thing that populates this table), never a Jumphour role or workflow
//      problem, so the copy below names GitHub explicitly and never talks
//      about a board being empty.
import { INSTALLATION_REQUIRED_EXPLANATION } from "./signed-in-surface";

export const NO_ACCESSIBLE_REPOSITORIES_EXPLANATION =
  "GitHub reports no repositories your account can access through this installation yet. Ask an organization administrator to grant your GitHub account access to a repository selected for this installation, or select more repositories when managing the Jumphour GitHub App install.";

export interface ResolveRepositoryListEmptyStateParams {
  /** The signed-in session's current installation id, or null when none is
   * selected (task 3.5's zero-overlap / "App is not installed" case). */
  installationId: number | null;
  /** Row count of the already-joined repository/discovery table (task 8.1's
   * buildRepositoryTableRows output length) for that installation. Ignored
   * when `installationId` is null -- there is no installation to have
   * joined rows for. */
  rowCount: number;
}

/**
 * Resolves the empty-state explanation the signed-in surface shows
 * alongside an empty repository table, or `null` once there is at least one
 * row. Pure and synchronous -- both branches read values already resolved
 * elsewhere (the session's stored installationId, the already-joined row
 * count); this function never queries GitHub or a driver itself.
 */
export function resolveRepositoryListEmptyState(
  params: ResolveRepositoryListEmptyStateParams,
): string | null {
  if (params.installationId === null) {
    return INSTALLATION_REQUIRED_EXPLANATION;
  }
  if (params.rowCount === 0) {
    return NO_ACCESSIBLE_REPOSITORIES_EXPLANATION;
  }
  return null;
}
