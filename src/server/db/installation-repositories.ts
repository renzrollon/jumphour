// Write and read paths for the `installation_repositories` table (tasks 2.2,
// 7.1). `(installation_id, github_repo_id)` is the primary key set by
// migration 0001. GitHub's numeric repository id is the durable identity and
// `full_name` is a display alias that MAY change on rename (design.md
// Decision 4, and specs/openspec-discovery/spec.md "renamed GitHub full_name
// keeps one identity"), so re-observing a known id must update `full_name`
// in place rather than create a second row.
//
// `listInstallationRepositories` is the read side of task 7.1
// (specs/github-app-installation/spec.md "Isolate data by GitHub App
// installation"): every row it returns is filtered by `installation_id` in
// SQL, never by fetching everything and narrowing in application code, so a
// caller passing installation A's id structurally cannot receive
// installation B's rows even though both may list a repository with the
// same `github_repo_id` (see ./installation-repositories.test.ts's
// cross-installation case).
import type { SqlDriver } from "./types";

export interface InstallationRepositoryUpsert {
  installationId: number;
  githubRepoId: number;
  fullName: string;
}

export interface InstallationRepositoryRow {
  installationId: number;
  githubRepoId: number;
  fullName: string;
}

/**
 * Inserts the row for `(installationId, githubRepoId)`, or — if one already
 * exists — updates its `full_name` in place. Portable ANSI upsert (CLAUDE.md
 * "Database portability"): attempt UPDATE first and INSERT only when no row
 * matched, rather than `ON CONFLICT`/`MERGE`, which differ across SQLite and
 * Postgres.
 */
export function upsertInstallationRepository(
  driver: SqlDriver,
  { installationId, githubRepoId, fullName }: InstallationRepositoryUpsert,
): void {
  const now = new Date().toISOString();

  driver.transaction(() => {
    const result = driver.run(
      `UPDATE installation_repositories
       SET full_name = ?, updated_at = ?
       WHERE installation_id = ? AND github_repo_id = ?`,
      [fullName, now, installationId, githubRepoId],
    );

    if (result.changes === 0) {
      driver.run(
        `INSERT INTO installation_repositories
           (installation_id, github_repo_id, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [installationId, githubRepoId, fullName, now, now],
      );
    }
  });
}

/**
 * Returns every repository row stored for `installationId`, ordered by
 * `full_name`. The `WHERE installation_id = ?` clause is the tenancy
 * boundary (design.md Decision 3 and Decision 4's "Tenancy" row: "All
 * queries" read scoped by `installation_id`) — there is no unscoped variant
 * of this query in the codebase to call by mistake.
 */
export function listInstallationRepositories(
  driver: SqlDriver,
  installationId: number,
): InstallationRepositoryRow[] {
  const rows = driver.all<{ installation_id: number; github_repo_id: number; full_name: string }>(
    `SELECT installation_id, github_repo_id, full_name
     FROM installation_repositories
     WHERE installation_id = ?
     ORDER BY full_name`,
    [installationId],
  );

  return rows.map((row) => ({
    installationId: row.installation_id,
    githubRepoId: row.github_repo_id,
    fullName: row.full_name,
  }));
}
