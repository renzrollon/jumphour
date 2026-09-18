// Task 6.6: design.md Decision 6 ("Cache reports per (installation_id,
// github_repo_id) with observed_at ... on refresh, overwrite the report")
// and specs/openspec-discovery/spec.md "Scope discovery reports to the
// installation" + "concurrent discovery runs do not write". Wraps task 6.1's
// classifyOpenSpecSupport (the read-only GitHub classification) and task
// 6.6's upsertDiscoveryReport (the write-side overwrite) into the one
// operation a caller (the repository table's refresh, and the
// load-if-absent path) actually needs — same wrap-then-persist shape as
// ./sync-accessible-repositories.ts wraps task 4.1's fetch with task 2.2's
// upsert.
//
// classifyOpenSpecSupport itself never issues a non-GET GitHub call (see its
// module comment); this wrapper adds no GitHub call of its own, so running it
// twice concurrently for the same repository still issues zero GitHub
// writes — it only ever overwrites the local `discovery_reports` row.
import { classifyOpenSpecSupport, type ClassifyOpenSpecSupportParams, type OpenSpecDiscoveryReport } from "./classify-openspec-support";
import { upsertDiscoveryReport } from "../db/discovery-reports";
import type { SqlDriver } from "../db/types";

export interface RunOpenSpecDiscoveryParams extends ClassifyOpenSpecSupportParams {
  installationId: number;
  /** GitHub-canonical repository id — the durable identity discovery reports
   * are keyed by (design.md Decision 4), not the mutable `owner/repo` pair
   * also passed here for the GitHub reads themselves. */
  githubRepoId: number;
  driver: SqlDriver;
}

/**
 * Runs `classifyOpenSpecSupport` for one repository and persists the result
 * under `(installationId, githubRepoId)`, overwriting any prior report for
 * that pair. Returns the freshly computed report so a caller does not need a
 * second read of what it just stored.
 */
export async function runOpenSpecDiscovery(
  params: RunOpenSpecDiscoveryParams,
): Promise<OpenSpecDiscoveryReport> {
  const { installationId, githubRepoId, driver, ...classifyParams } = params;
  const report = await classifyOpenSpecSupport(classifyParams);

  upsertDiscoveryReport(driver, {
    installationId,
    githubRepoId,
    status: report.status,
    defaultBranch: report.defaultBranch,
    tipSha: report.tipSha,
    configPath: report.configPath ?? null,
    schema: report.schema ?? null,
    reason: report.reason ?? null,
  });

  return report;
}
