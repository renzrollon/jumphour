// Task 9.1 (specs/app-shell/spec.md "Preserve the repository and discovery
// surface inside the shell"): the signed-in repository and discovery view,
// rendered as the shell's content. It is the pre-shell page body moved
// verbatim into one presentational component — the same installation
// picker, the same empty-state copy (whatever
// resolveRepositoryListEmptyState() returned), the same RepositoryTable over
// the same rows, and the same Refresh form posting to /api/github/refresh.
// Only the layout around them is new; which rows are shown, what the empty
// state says, and what Refresh targets are all decided by the caller
// (src/app/repositories/page.tsx, workflow-board-ui task 6.2) exactly as before.
//
// No Idea / OpenSpec change / In progress / PR/MR board column is rendered
// here: RepositoryTable's fixed REPOSITORY_TABLE_COLUMNS is the only column
// source, and this view adds none.
import type { RepositoryTableRow } from "../../server/github/repository-table-view";
import { RepositoryTable } from "./repository-table";
import { InstallationPicker } from "./installation-picker";
import { Button } from "./ui/button";
import styles from "./repository-surface.module.css";

export const REFRESH_ACTION = "/api/github/refresh";

export interface RepositorySurfaceProps {
  installationId: number | null;
  rows: readonly RepositoryTableRow[];
  emptyStateExplanation: string | null;
}

export function RepositorySurface({ installationId, rows, emptyStateExplanation }: RepositorySurfaceProps) {
  return (
    <section className={styles.surface} aria-labelledby="repository-surface-title">
      <div className={styles.header}>
        <h1 id="repository-surface-title" className={styles.title}>
          Repositories
        </h1>
        {installationId !== null ? (
          <form action={REFRESH_ACTION} method="post">
            <Button type="submit">Refresh</Button>
          </form>
        ) : null}
      </div>
      <InstallationPicker installations={[]} currentInstallationId={installationId} />
      {emptyStateExplanation ? <p className={styles.empty}>{emptyStateExplanation}</p> : null}
      <div className={styles.tableFrame}>
        <RepositoryTable rows={rows} />
      </div>
    </section>
  );
}
