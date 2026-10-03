// workflow-board-ui task 6.2 (specs/github-app-installation/spec.md "Present
// a thin signed-in repository and discovery surface", as MODIFIED; design.md
// Decision 9): the repository and discovery view, moved verbatim from the
// pre-board `src/app/page.tsx` when `/` became the workflow board. The same
// installation picker, the same empty-state copy
// (../../server/github/repository-list-empty-state.ts), the same
// RepositoryTable over the same installation-scoped rows, and the same
// Refresh form posting to /api/github/refresh — rendered by
// ../components/repository-surface.tsx inside the shell. It renders no board
// lane and passes nothing to the shell's search slot.
//
// Reads only already-stored, installation-scoped rows
// (listInstallationRepositories / listDiscoveryReports) — never a live GitHub
// call on page load. The Refresh form is the one way this view triggers a
// live GitHub read, through ../api/github/refresh/route.ts and the OAuth
// round trip, which returns here (REFRESH_RETURN_PATH).
//
// The installation picker always receives a single-installation (or empty)
// list here and renders nothing (see ../components/installation-picker.tsx):
// enumerating every installation the user belongs to needs a live `GET
// /user/installations` call or a stored per-user membership set, neither
// available on a plain page load with today's schema.
//
// Task 6.3: the shell marks Repositories as the current navigation item.
//
// A signed-out visitor has no repository view; they are redirected to `/`,
// which renders the sign-in view.
import { redirect } from "next/navigation";
import { listInstallationRepositories } from "../../server/db/installation-repositories";
import { listDiscoveryReports } from "../../server/db/discovery-reports";
import { buildRepositoryTableRows } from "../../server/github/repository-table-view";
import { resolveRepositoryListEmptyState } from "../../server/github/repository-list-empty-state";
import { RepositorySurface } from "../components/repository-surface";
import { AppShell } from "../components/shell/app-shell";
import { readSignedInRequest } from "../signed-in-request";

export default async function RepositoriesPage() {
  const signedIn = await readSignedInRequest();
  if (!signedIn) redirect("/");

  const { driver, session, shell } = signedIn;
  const rows =
    session.installationId === null
      ? []
      : buildRepositoryTableRows(
          listInstallationRepositories(driver, session.installationId),
          listDiscoveryReports(driver, session.installationId),
        );
  const emptyStateExplanation = resolveRepositoryListEmptyState({
    installationId: session.installationId,
    rowCount: rows.length,
  });

  return (
    <AppShell {...shell} currentNav="repositories">
      <RepositorySurface
        installationId={session.installationId}
        rows={rows}
        emptyStateExplanation={emptyStateExplanation}
      />
    </AppShell>
  );
}
