// Task 3.5: when GitHub reports zero installations overlapping the
// signed-in user (task 3.3's GET /user/installations listing — already
// GitHub's own intersection of "installations of this App" and
// "installations this user can access"), the repository list must explain
// that a GitHub App installation is required. specs/github-app-installation
// /spec.md "Failure — App is not installed": "the system does not list any
// repositories as Jumphour-accessible" AND "it explains that a GitHub App
// installation is required" — distinct from the "no overlapping repository
// access" edge case (a real installation exists, but this user can't reach
// any repo in it), whose different copy is a later task's concern.
//
// Repository listing itself is task 4.1 and does not exist yet, so
// `repositories` here is always empty; task 4.x supplies the real
// installation-scoped list above this explanation gate, and task 8.x's page
// renders exactly these two fields.
export interface SignedInSurface {
  repositories: never[];
  explanation: string | null;
}

export const INSTALLATION_REQUIRED_EXPLANATION =
  "No GitHub App installation is available to this account. Ask an organization administrator to install the Jumphour GitHub App for the repositories you need.";

export interface ResolveSignedInSurfaceParams {
  /** Count of installations GitHub reports as overlapping the signed-in
   * user (task 3.3's `recoverMissedInstallations(...).installations.length`). */
  overlappingInstallationCount: number;
}

export function resolveSignedInSurface(params: ResolveSignedInSurfaceParams): SignedInSurface {
  if (params.overlappingInstallationCount === 0) {
    return { repositories: [], explanation: INSTALLATION_REQUIRED_EXPLANATION };
  }
  return { repositories: [], explanation: null };
}
