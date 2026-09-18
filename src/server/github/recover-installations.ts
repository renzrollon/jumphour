// Task 3.3: recover an installation whose Setup URL redirect the
// administrator never completed (design.md "Setup URL missed" risk: "Admin
// closes the GitHub tab before redirect. Mitigation: signed-in user can
// link an installation via GET /user/installations and persist any not yet
// stored; do not require webhook to recover.").
//
// `listInstallations` is injected (task 3.3's ./oauth.ts#fetchUserInstallations
// in production) so this can be proven without a live GitHub call — see
// ./recover-installations.test.ts. Persistence reuses task 2.2's
// upsertInstallation, so a repeat id already known to Jumphour is left as
// an update, never a second row.
import type { SqlDriver } from "../db/types";
import { upsertInstallation } from "../db/installations";
import type { GithubInstallationSummary } from "./oauth";

export interface ListUserInstallationsFn {
  (accessToken: string): Promise<GithubInstallationSummary[]>;
}

export interface RecoverMissedInstallationsParams {
  /** The signed-in user's own OAuth access token (user-to-server). */
  accessToken: string;
  driver: SqlDriver;
  listInstallations: ListUserInstallationsFn;
}

export interface RecoverMissedInstallationsOutcome {
  /** Every installation GitHub reports for this user — already GitHub's
   * own intersection of "installations of this App" and "installations
   * this user can access". Task 3.5 reads this list's length to decide
   * whether any overlap exists at all. */
  installations: GithubInstallationSummary[];
  /** Ids that had no `installations` row before this call and were just
   * persisted by it. An id already known to Jumphour (a completed Setup
   * URL redirect, or a prior recovery) is not included here even though
   * its row still gets refreshed by upsertInstallation. */
  recordedIds: number[];
}

/**
 * Lists the signed-in user's GitHub App installations and persists any
 * Jumphour does not yet have a row for. Never calls a GitHub write
 * endpoint — `listInstallations` is the only GitHub interaction, and it is
 * a read (`GET /user/installations`).
 */
export async function recoverMissedInstallations(
  params: RecoverMissedInstallationsParams,
): Promise<RecoverMissedInstallationsOutcome> {
  const { accessToken, driver, listInstallations } = params;

  const installations = await listInstallations(accessToken);
  const recordedIds: number[] = [];

  for (const installation of installations) {
    const existing = driver.get<{ github_installation_id: number }>(
      "SELECT github_installation_id FROM installations WHERE github_installation_id = ?",
      [installation.githubInstallationId],
    );

    if (existing) continue;

    upsertInstallation(driver, {
      githubInstallationId: installation.githubInstallationId,
      accountId: installation.accountId,
      accountLogin: installation.accountLogin,
      permissionSnapshot: installation.permissions ? JSON.stringify(installation.permissions) : null,
    });
    recordedIds.push(installation.githubInstallationId);
  }

  return { installations, recordedIds };
}
