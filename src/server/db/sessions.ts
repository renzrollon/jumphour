// Read/write path for the `sessions` table's `installation_id` column
// (task 7.2: specs/github-app-installation/spec.md "Edge case — same
// GitHub user in two installations"). Session rows themselves are created
// by ../github/oauth-session.ts (task 3.4, `installation_id` starting
// NULL); this module only ever updates the `installation_id` an existing
// session already has, or reads it back — it never creates or deletes a
// session row.
import type { SqlDriver } from "./types";

export interface SessionRow {
  sessionId: string;
  githubUserId: number;
  installationId: number | null;
}

interface SessionSqlRow {
  id: string;
  github_user_id: number;
  installation_id: number | null;
}

/**
 * Sets `installation_id` on the session row identified by `sessionId`.
 * Returns `false` (no row updated) when no session exists for that id, so
 * a caller — see ../github/switch-current-installation.ts — never mistakes
 * "no such session" for a successful switch.
 */
export function setSessionInstallation(driver: SqlDriver, sessionId: string, installationId: number): boolean {
  const result = driver.run(`UPDATE sessions SET installation_id = ? WHERE id = ?`, [installationId, sessionId]);
  return result.changes > 0;
}

/**
 * Returns the session row (including its current `installation_id`), or
 * `undefined` if no session exists for `sessionId`.
 */
export function getSession(driver: SqlDriver, sessionId: string): SessionRow | undefined {
  const row = driver.get<SessionSqlRow>(`SELECT id, github_user_id, installation_id FROM sessions WHERE id = ?`, [
    sessionId,
  ]);

  if (!row) return undefined;

  return { sessionId: row.id, githubUserId: row.github_user_id, installationId: row.installation_id };
}
