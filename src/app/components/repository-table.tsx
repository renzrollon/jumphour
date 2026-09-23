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
//
// design-system-and-app-shell task 9.3: restyled through
// repository-table.module.css — class names only; the element structure,
// the column set and the exported props are unchanged. Repository names and
// branch names use the monospace face (specs/design-system/spec.md "Type the
// interface with one scale and a monospace companion").
import type { RepositoryTableRow } from "../../server/github/repository-table-view";
import styles from "./repository-table.module.css";

export const REPOSITORY_TABLE_COLUMNS = ["Repository", "Default branch", "Status", "Reason"] as const;

export interface RepositoryTableProps {
  rows: readonly RepositoryTableRow[];
}

export function RepositoryTable({ rows }: RepositoryTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {REPOSITORY_TABLE_COLUMNS.map((column) => (
            <th key={column} scope="col" className={styles.th}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.githubRepoId} className={styles.row}>
            <td className={`${styles.td} ${styles.mono}`}>{row.fullName}</td>
            <td className={`${styles.td} ${styles.mono}`}>{row.defaultBranch ?? "—"}</td>
            <td className={`${styles.td} ${styles.status}`}>{row.statusLabel}</td>
            <td className={`${styles.td} ${styles.reason}`}>{row.reason ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
