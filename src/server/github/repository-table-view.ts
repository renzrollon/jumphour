// Task 8.1: joins task 7.1's two installation-scoped read paths —
// listInstallationRepositories (canonical full_name) and
// listDiscoveryReports (default branch + status/reason) — into the exact
// row shape specs/github-app-installation/spec.md's "Present a thin
// signed-in repository and discovery surface" requirement names: "each
// accessible repository with its discovery status." design.md Decision 8:
// "repository table (canonical full_name, default branch, support status,
// reason)".
//
// This module never inspects raw GitHub contents itself — it only reads
// stored `installation_repositories`/`discovery_reports` rows already
// written by task 4.x/6.x, and delegates status/reason rendering to task
// 6.7's toDiscoveryStatusView (design.md line 127: "one classifier; UI reads
// status/reason only"). A repository with no discovery report yet (never
// discovered) is rendered with a distinct "not yet checked" label rather
// than guessing a canonical `supported`/`unsupported`/`permission-blocked`
// value the discovery classifier never actually computed.
import type { InstallationRepositoryRow } from "../db/installation-repositories";
import type { DiscoveryReportRow } from "../db/discovery-reports";
import { toDiscoveryStatusView, type StoredDiscoveryReport } from "./discovery-report-view";
import type { OpenSpecSupportStatus } from "./classify-openspec-support";

export const NOT_YET_DISCOVERED_LABEL = "Not yet checked";

export interface RepositoryTableRow {
  githubRepoId: number;
  /** GitHub-canonical `owner/name` (design.md Decision 4) — never a
   * user-typed string. */
  fullName: string;
  /** Null when discovery has not run for this repository yet, or when it
   * ran but repository metadata could not be read (design.md Decision 6
   * step 1: "Do not invent main"). */
  defaultBranch: string | null;
  status: OpenSpecSupportStatus | null;
  statusLabel: string;
  reason: string | null;
}

/**
 * Builds the repository table's row view models by joining a repository
 * list with its discovery reports on `github_repo_id`. Row order follows
 * `repositories` (already ordered by `full_name` per
 * ../db/installation-repositories.ts#listInstallationRepositories).
 */
export function buildRepositoryTableRows(
  repositories: readonly InstallationRepositoryRow[],
  discoveryReports: readonly DiscoveryReportRow[],
): RepositoryTableRow[] {
  const reportsByRepoId = new Map(discoveryReports.map((report) => [report.githubRepoId, report]));

  return repositories.map((repository) => {
    const report = reportsByRepoId.get(repository.githubRepoId);

    if (!report) {
      return {
        githubRepoId: repository.githubRepoId,
        fullName: repository.fullName,
        defaultBranch: null,
        status: null,
        statusLabel: NOT_YET_DISCOVERED_LABEL,
        reason: null,
      };
    }

    // discovery_reports.status is DB-typed as `string`, but migration
    // 0002's CHECK constraint (task 2.3) already restricts every stored
    // value to the three canonical OpenSpecSupportStatus values, and
    // task 6.6's upsertDiscoveryReport is the only writer, always passed a
    // classifier-produced OpenSpecSupportStatus — so this cast reflects an
    // invariant the schema enforces, not a guess.
    const storedReport: StoredDiscoveryReport = {
      status: report.status as OpenSpecSupportStatus,
      reason: report.reason,
    };
    const view = toDiscoveryStatusView(storedReport);

    return {
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      defaultBranch: report.defaultBranch,
      status: view.status,
      statusLabel: view.label,
      reason: view.reason,
    };
  });
}
