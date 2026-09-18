// Write path for the `installations` table (task 2.2). `github_installation_id`
// is the primary key set by migration 0001 (design.md Decision 7:
// "installations — github_installation_id (unique)"), so a second Setup URL
// visit or `GET /user/installations` sighting for an installation the app
// already knows about must update the existing row rather than fail or
// duplicate it.
import type { SqlDriver } from "./types";

export interface InstallationUpsert {
  githubInstallationId: number;
  accountId: number;
  accountLogin: string;
  /** Raw permission snapshot, if already known (task 5.x populates this). */
  permissionSnapshot?: string | null;
}

/**
 * Inserts the row for `githubInstallationId`, or — if one already exists —
 * updates its account/permission fields in place. Portable ANSI upsert
 * (CLAUDE.md "Database portability"): attempt UPDATE first and INSERT only
 * when no row matched, rather than `ON CONFLICT`/`MERGE`, which differ across
 * SQLite and Postgres.
 */
export function upsertInstallation(driver: SqlDriver, params: InstallationUpsert): void {
  const { githubInstallationId, accountId, accountLogin } = params;
  const permissionSnapshot = params.permissionSnapshot ?? null;
  const now = new Date().toISOString();

  driver.transaction(() => {
    const result = driver.run(
      `UPDATE installations
       SET account_id = ?, account_login = ?, permission_snapshot = ?, updated_at = ?
       WHERE github_installation_id = ?`,
      [accountId, accountLogin, permissionSnapshot, now, githubInstallationId],
    );

    if (result.changes === 0) {
      driver.run(
        `INSERT INTO installations
           (github_installation_id, account_id, account_login, permission_snapshot, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [githubInstallationId, accountId, accountLogin, permissionSnapshot, now, now],
      );
    }
  });
}
