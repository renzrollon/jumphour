// Task 8.2 (specs/app-shell/spec.md "Name the workspace from the real GitHub
// App installation"; design.md Decision 8 and the invariant sweep's
// "Workspace label" row): the server-side read behind the top app bar's
// workspace element. Every name it returns is an `accountLogin` read from a
// stored installation row through `getInstallation()` — never the numeric id,
// never an invented or prototype name. A missing row is a missing row: it is
// left out, and when the session's own installation is missing the view says
// so (`current: null`), which the element renders as "No installation".
//
// `knownInstallationIds` is the set of installations known for the signed-in
// user. Nothing stores that set today (see src/app/page.tsx's note on
// `GET /user/installations`), so callers pass none and the only reachable
// states are the static label and the neutral fallback; the switcher appears
// by itself once some caller supplies two or more stored installations.
import type { SqlDriver } from "../../../server/db/types";
import { getInstallation, type InstallationSummary } from "../../../server/db/installations";

export interface WorkspaceView {
  /** The installation the page below is showing, or null when none is bound or stored. */
  current: InstallationSummary | null;
  /** Every stored installation known for the user, current one included, in a stable order. */
  installations: readonly InstallationSummary[];
}

export const NO_WORKSPACE: WorkspaceView = { current: null, installations: [] };

export function resolveWorkspace(
  driver: SqlDriver,
  currentInstallationId: number | null,
  knownInstallationIds: readonly number[] = [],
): WorkspaceView {
  const current = currentInstallationId === null ? undefined : getInstallation(driver, currentInstallationId);

  const ids = new Set<number>(knownInstallationIds);
  if (current) ids.add(current.installationId);

  const installations: InstallationSummary[] = [];
  for (const id of ids) {
    const row = id === current?.installationId ? current : getInstallation(driver, id);
    if (row) installations.push(row);
  }

  return { current: current ?? null, installations };
}
