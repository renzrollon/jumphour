// Task 8.1: proves buildRepositoryTableRows joins a repository list with its
// discovery reports into exactly the fields the repository table renders
// (canonical full_name, default branch, status, reason) and renders a
// distinct "not yet checked" row — never a guessed canonical status — for a
// repository discovery has not run for.
import { describe, expect, it } from "vitest";
import { buildRepositoryTableRows, NOT_YET_DISCOVERED_LABEL } from "./repository-table-view";
import type { InstallationRepositoryRow } from "../db/installation-repositories";
import type { DiscoveryReportRow } from "../db/discovery-reports";

function discoveryReport(overrides: Partial<DiscoveryReportRow>): DiscoveryReportRow {
  return {
    installationId: 1,
    githubRepoId: 0,
    status: "supported",
    defaultBranch: "main",
    tipSha: "abc123",
    configPath: "openspec/config.yaml",
    schema: null,
    reason: null,
    observedAt: "2026-09-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildRepositoryTableRows", () => {
  const repositories: InstallationRepositoryRow[] = [
    { installationId: 1, githubRepoId: 101, fullName: "acme/api-gateway" },
    { installationId: 1, githubRepoId: 102, fullName: "acme/customer-web" },
    { installationId: 1, githubRepoId: 103, fullName: "acme/no-report-yet" },
  ];

  const discoveryReports: DiscoveryReportRow[] = [
    discoveryReport({ githubRepoId: 101, status: "supported", defaultBranch: "main", reason: null }),
    discoveryReport({
      githubRepoId: 102,
      status: "permission-blocked",
      defaultBranch: null,
      tipSha: null,
      configPath: null,
      reason: "GitHub denied reading repository metadata (403)",
    }),
    // github_repo_id 999 belongs to no repository in `repositories` and
    // must never surface as a row of its own.
    discoveryReport({ githubRepoId: 999, status: "unsupported", reason: "unrelated repo" }),
  ];

  it("renders canonical full_name, default branch, status, and reason for a populated fixture", () => {
    const rows = buildRepositoryTableRows(repositories, discoveryReports);

    expect(rows).toHaveLength(3);

    expect(rows[0]).toEqual({
      githubRepoId: 101,
      fullName: "acme/api-gateway",
      defaultBranch: "main",
      status: "supported",
      statusLabel: "OpenSpec supported",
      reason: null,
    });

    expect(rows[1]).toEqual({
      githubRepoId: 102,
      fullName: "acme/customer-web",
      defaultBranch: null,
      status: "permission-blocked",
      statusLabel: "Access needed",
      reason: "GitHub denied reading repository metadata (403)",
    });
  });

  it("labels a repository with no discovery report yet as not-yet-checked rather than a guessed status", () => {
    const rows = buildRepositoryTableRows(repositories, discoveryReports);

    expect(rows[2]).toEqual({
      githubRepoId: 103,
      fullName: "acme/no-report-yet",
      defaultBranch: null,
      status: null,
      statusLabel: NOT_YET_DISCOVERED_LABEL,
      reason: null,
    });
  });

  it("never surfaces a discovery report for a repository outside the given list", () => {
    const rows = buildRepositoryTableRows(repositories, discoveryReports);

    expect(rows.some((row) => row.githubRepoId === 999)).toBe(false);
  });
});
