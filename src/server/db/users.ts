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
