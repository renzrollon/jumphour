// Write path for the `users` table (task 3.4). `github_user_id` is the
// primary key set by migration 0001 (design.md Decision 7: "users —
// github_user_id (unique), login"), so signing in again as a GitHub user
// already known to this app must update the row (e.g. a changed `login`)
// rather than fail or duplicate it — the same upsert-by-primary-key shape
// as ./installations.ts and ./installation-repositories.ts.
import type { SqlDriver } from "./types";

export interface UserUpsert {
  githubUserId: number;
  login: string;
}

export function upsertUser(driver: SqlDriver, { githubUserId, login }: UserUpsert): void {
  driver.transaction(() => {
    const result = driver.run(`UPDATE users SET login = ? WHERE github_user_id = ?`, [login, githubUserId]);

    if (result.changes === 0) {
      driver.run(`INSERT INTO users (github_user_id, login) VALUES (?, ?)`, [githubUserId, login]);
    }
  });
}

export interface UserSummary {
  githubUserId: number;
  login: string;
}

interface UserSummarySqlRow {
  github_user_id: number;
  login: string;
}

/**
 * Returns the stored GitHub user id and login, or `undefined` when no row
 * exists for `githubUserId`.
 */
export function getUser(driver: SqlDriver, githubUserId: number): UserSummary | undefined {
  const row = driver.get<UserSummarySqlRow>(`SELECT github_user_id, login FROM users WHERE github_user_id = ?`, [
    githubUserId,
  ]);

  if (!row) return undefined;

  return { githubUserId: row.github_user_id, login: row.login };
}
