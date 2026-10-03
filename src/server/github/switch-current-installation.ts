// Task 7.2: specs/github-app-installation/spec.md "Edge case — same GitHub
// user in two installations": "GIVEN the same GitHub user is authorized in
// installation A and installation B, WHEN they switch from A to B, THEN
// the repository list and discovery reports are those of B only, AND A and
// B are not merged into one list." design.md Decision 3: "A signed-in user
// who belongs to multiple installations gets an installation switcher;
// lists and reports never merge."
//
// `accessibleInstallationIds` is the caller-supplied, already-GitHub-
// confirmed set (task 3.3's recoverMissedInstallations(...).installations
// in production — GitHub's own intersection of "installations of this App"
// and "installations this user can access", per design.md Decision 2).
// There is no user-to-installation membership table in this schema
// (migration 0001 has no such table), so switching never re-derives
// membership from a locally stored table; it only ever accepts what a
// fresh GET /user/installations already proved for this signed-in user —
// same boundary as task 4.4's authorizeRepositoryRequest checks a stored
// table instead of calling GitHub, just with GitHub's listing as the
// authority here since no local membership table exists to check instead.
//
// Switching itself is a single column update on the caller's own session
// row (../db/sessions.ts#setSessionInstallation). Because every
// repository/discovery read in this codebase is scoped by
// `installation_id` in its SQL WHERE clause (task 7.1's
// listInstallationRepositories / getDiscoveryReport / listDiscoveryReports),
// changing that one column is sufficient for "replaces the list, no
// merge": a query issued with the new installation_id can only ever
// return that installation's rows — see ./switch-current-installation.test.ts.
import type { SqlDriver } from "../db/types";
import { setSessionInstallation } from "../db/sessions";

export interface SwitchCurrentInstallationParams {
  sessionId: string;
  targetInstallationId: number;
  /** Installations GitHub has already confirmed for this signed-in user
   * (task 3.3's `GET /user/installations` listing). */
  accessibleInstallationIds: readonly number[];
  driver: SqlDriver;
}

export type SwitchCurrentInstallationOutcome =
  | { switched: true; installationId: number }
  | { switched: false; reason: string };

/**
 * Switches the session's current installation to `targetInstallationId`,
 * refusing when GitHub has not confirmed that installation for this user
 * (`accessibleInstallationIds`) or when `sessionId` does not exist. Never
 * queries GitHub itself and never merges: it writes exactly one
 * `installation_id` value, replacing whatever the session held before.
 */
export function switchCurrentInstallation(
  params: SwitchCurrentInstallationParams,
): SwitchCurrentInstallationOutcome {
  const { sessionId, targetInstallationId, accessibleInstallationIds, driver } = params;

  if (!accessibleInstallationIds.includes(targetInstallationId)) {
    return {
      switched: false,
      reason: `installation ${targetInstallationId} is not accessible to this signed-in user`,
    };
  }

  const updated = setSessionInstallation(driver, sessionId, targetInstallationId);
  if (!updated) {
    return { switched: false, reason: `no session found for id ${sessionId}` };
  }

  return { switched: true, installationId: targetInstallationId };
}
