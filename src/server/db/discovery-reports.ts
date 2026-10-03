// Write and read paths for the `discovery_reports` table (tasks 6.6, 7.1).
// `(installation_id, github_repo_id)` is the primary key set by migration
// 0001 (design.md Decision 7), so a later discovery run for a GitHub
// repository this app already has a report for must overwrite that row in
// place rather than create a second one — design.md Decision 6: "Do not
// treat cache as more authoritative than GitHub; on refresh, overwrite the
// report." Same UPDATE-first-else-INSERT shape as ./installations.ts and
// ./installation-repositories.ts (portable ANSI upsert, CLAUDE.md "Database
// portability": no `ON CONFLICT`/`MERGE`).
//
// `getDiscoveryReport` and `listDiscoveryReports` are the read side of task
// 7.1 (specs/openspec-discovery/spec.md "Scope discovery reports to the
// installation"): both filter by `installation_id` in the SQL `WHERE`
// clause, so requesting installation B's context can never surface
// installation A's report for a `github_repo_id` GitHub happens to reuse
// across the two installations — see ./discovery-reports.test.ts's
// cross-installation case.
import type { SqlDriver } from "./types";

export interface DiscoveryReportUpsert {
  installationId: number;
  githubRepoId: number;
  status: string;
  defaultBranch: string | null;
  tipSha: string | null;
  configPath?: string | null;
  schema?: string | null;
  reason?: string | null;
}

export interface DiscoveryReportRow {
  installationId: number;
  githubRepoId: number;
  status: string;
  defaultBranch: string | null;
  tipSha: string | null;
  configPath: string | null;
  schema: string | null;
  reason: string | null;
  observedAt: string;
}

interface DiscoveryReportSqlRow {
  installation_id: number;
  github_repo_id: number;
  status: string;
  default_branch: string | null;
  tip_sha: string | null;
  config_path: string | null;
  schema: string | null;
  reason: string | null;
  observed_at: string;
}

function toDiscoveryReportRow(row: DiscoveryReportSqlRow): DiscoveryReportRow {
  return {
    installationId: row.installation_id,
    githubRepoId: row.github_repo_id,
    status: row.status,
    defaultBranch: row.default_branch,
    tipSha: row.tip_sha,
    configPath: row.config_path,
    schema: row.schema,
    reason: row.reason,
    observedAt: row.observed_at,
  };
}

const DISCOVERY_REPORT_COLUMNS =
  "installation_id, github_repo_id, default_branch, tip_sha, status, config_path, schema, reason, observed_at";

/**
 * Inserts the row for `(installationId, githubRepoId)`, or — if one already
 * exists — overwrites every column in place, including `observed_at`. There
 * is no merge: a report that was `supported` on the previous run and is
 * `permission-blocked` now must not keep any field from the earlier row
 * (design.md Decision 6, and specs/openspec-discovery/spec.md "concurrent
 * discovery runs do not write" — GitHub, not the cache, is authoritative).
 */
export function upsertDiscoveryReport(driver: SqlDriver, params: DiscoveryReportUpsert): void {
  const {
    installationId,
    githubRepoId,
    status,
    defaultBranch,
    tipSha,
    configPath = null,
    schema = null,
    reason = null,
  } = params;
  const observedAt = new Date().toISOString();

  driver.transaction(() => {
    const result = driver.run(
      `UPDATE discovery_reports
       SET default_branch = ?, tip_sha = ?, status = ?, config_path = ?, schema = ?, reason = ?, observed_at = ?
       WHERE installation_id = ? AND github_repo_id = ?`,
      [defaultBranch, tipSha, status, configPath, schema, reason, observedAt, installationId, githubRepoId],
    );

    if (result.changes === 0) {
      driver.run(
        `INSERT INTO discovery_reports
           (installation_id, github_repo_id, default_branch, tip_sha, status, config_path, schema, reason, observed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [installationId, githubRepoId, defaultBranch, tipSha, status, configPath, schema, reason, observedAt],
      );
    }
  });
}

/**
 * Returns the stored report for exactly `(installationId, githubRepoId)`, or
 * `undefined` if none exists. Requesting the pair under a different
 * `installationId` than the one the report was written with can never
 * return that row — the primary key requires both columns to match, and the
 * `WHERE` clause below never trusts `githubRepoId` alone (design.md Decision
 * 4: GitHub may reuse a `github_repo_id`-shaped identity across
 * installations only insofar as two installations can each have their own
 * row for the same numeric id; they stay two separate rows here).
 */
export function getDiscoveryReport(
  driver: SqlDriver,
  installationId: number,
  githubRepoId: number,
): DiscoveryReportRow | undefined {
  const row = driver.get<DiscoveryReportSqlRow>(
    `SELECT ${DISCOVERY_REPORT_COLUMNS}
     FROM discovery_reports
     WHERE installation_id = ? AND github_repo_id = ?`,
    [installationId, githubRepoId],
  );

  return row ? toDiscoveryReportRow(row) : undefined;
}

/**
 * Returns every report stored for `installationId`. Same tenancy boundary as
 * `getDiscoveryReport`: the `WHERE installation_id = ?` clause is the only
 * filter, so there is no code path here that can leak another
 * installation's rows into the result.
 */
export function listDiscoveryReports(driver: SqlDriver, installationId: number): DiscoveryReportRow[] {
  const rows = driver.all<DiscoveryReportSqlRow>(
    `SELECT ${DISCOVERY_REPORT_COLUMNS}
     FROM discovery_reports
     WHERE installation_id = ?
     ORDER BY github_repo_id`,
    [installationId],
  );

  return rows.map(toDiscoveryReportRow);
}
