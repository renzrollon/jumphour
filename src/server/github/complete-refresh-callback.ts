// Task 8.4: the half of Refresh that runs on the OAuth callback.
//
// ../../app/api/github/refresh/route.ts sends the user to GitHub with the
// current installation encoded in `state` (./refresh-return-state.ts);
// ../../app/api/github/oauth/callback/route.ts receives them back holding a
// fresh user-to-server token — the one credential that can call the
// repository listing API (design.md Decision 2) — and hands off to here.
//
// This is a separate module from the route for the reason every other
// GitHub operation in this codebase is: the route handler stays a thin
// wire-up whose own test is hermetic (see ../../app/api/github/setup/
// route.test.ts's module comment), and the decisions live in an injectable
// unit that can be proven without mocking modules or reaching GitHub.
//
// Two things must happen in order, and the order matters:
//
//   1. RE-BIND the session. completeOAuthSignIn (task 3.4) always creates a
//      NEW session row with `installation_id` NULL, so without this the user
//      returns from Refresh signed in but looking at nothing. It goes
//      through task 7.2's switchCurrentInstallation rather than writing the
//      column directly, because `state` came back from the browser and is
//      not evidence of anything on its own — the switch refuses an
//      installation GitHub's own fresh listing did not confirm for this
//      user.
//   2. RE-LIST and RE-DISCOVER, via ./refresh-installation.ts.
//
// Every failure below is non-fatal by design: design.md Decision 8 calls
// this a "retry/refresh" affordance, so a Refresh that cannot reach GitHub
// must still land the user on their surface showing the rows already
// stored, never an error page. Each outcome is named rather than collapsed
// into a boolean so a caller (and this module's test) can tell "refused"
// from "could not mint a token" from "GitHub listing failed".
import { switchCurrentInstallation } from "./switch-current-installation";
import type { SqlDriver } from "../db/types";

export type CompleteRefreshCallbackOutcome =
  | { refreshed: true; installationId: number; repositoryCount: number }
  | { refreshed: false; reason: string };

export interface CompleteRefreshCallbackParams {
  sessionId: string;
  /** The installation named by the `state` marker — untrusted until
   * `accessibleInstallationIds` confirms it. */
  installationId: number;
  /** Installations GitHub just confirmed for this signed-in user (task
   * 3.3's recoverMissedInstallations output). */
  accessibleInstallationIds: readonly number[];
  driver: SqlDriver;
  /** Mints an installation access token for the discovery reads. Injected
   * so this is provable without App credentials; production passes task
   * 3.1's mintInstallationToken. */
  mintInstallationToken: (installationId: number) => Promise<{ token: string }>;
  /** Performs the listing + discovery. Production passes
   * ./refresh-installation.ts#refreshInstallationFromGithub. */
  refresh: (params: { installationId: number; installationToken: string }) => Promise<{
    status: "ok" | "failed";
    repositories: readonly unknown[];
  }>;
}

export async function completeRefreshCallback(
  params: CompleteRefreshCallbackParams,
): Promise<CompleteRefreshCallbackOutcome> {
  const switched = switchCurrentInstallation({
    sessionId: params.sessionId,
    targetInstallationId: params.installationId,
    accessibleInstallationIds: params.accessibleInstallationIds,
    driver: params.driver,
  });

  if (!switched.switched) {
    return { refreshed: false, reason: switched.reason };
  }

  let installationToken: string;
  try {
    const minted = await params.mintInstallationToken(params.installationId);
    installationToken = minted.token;
  } catch (error) {
    return {
      refreshed: false,
      reason: `could not mint an installation token: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  try {
    const outcome = await params.refresh({ installationId: params.installationId, installationToken });
    if (outcome.status === "failed") {
      return { refreshed: false, reason: "GitHub repository listing failed" };
    }
    return {
      refreshed: true,
      installationId: params.installationId,
      repositoryCount: outcome.repositories.length,
    };
  } catch (error) {
    return {
      refreshed: false,
      reason: `refresh failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
