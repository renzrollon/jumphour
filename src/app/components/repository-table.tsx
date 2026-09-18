// Task 8.1: the repository table design.md Decision 8 names ("repository
// table (canonical full_name, default branch, support status, reason)").
// Purely presentational — takes the already-joined row view models from
// ../../server/github/repository-table-view.ts and renders them; it never
// reads a driver, calls GitHub, or re-derives status/reason of its own.
//
// specs/github-app-installation/spec.md "Present a thin signed-in repository
// and discovery surface" requires: "they do not see workflow board columns"
// — REPOSITORY_TABLE_COLUMNS below is the complete, fixed column set this
// component can ever render. There is no Idea / OpenSpec change /
// In progress / PR/MR column here, and RepositoryTableRow (the only data
// this component reads) structurally carries no such fields either, so a
// board column cannot appear even by future accident to this file alone.
import type { RepositoryTableRow } from "../../server/github/repository-table-view";

export const REPOSITORY_TABLE_COLUMNS = ["Repository", "Default branch", "Status", "Reason"] as const;

export interface RepositoryTableProps {
  rows: readonly RepositoryTableRow[];
}

export function RepositoryTable({ rows }: RepositoryTableProps) {
  return (
    <table>
      <thead>
        <tr>
          {REPOSITORY_TABLE_COLUMNS.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.githubRepoId}>
            <td>{row.fullName}</td>
            <td>{row.defaultBranch ?? "—"}</td>
            <td>{row.statusLabel}</td>
            <td>{row.reason ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
