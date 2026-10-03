import { NextResponse } from "next/server";
import { getDriver } from "../../../../../server/db";
import { getEnv } from "../../../../../server/env";
import { exchangeOAuthCode, fetchGithubUser, fetchUserInstallations } from "../../../../../server/github/oauth";
import { completeOAuthSignIn, type OAuthSignInOutcome } from "../../../../../server/github/oauth-session";
import { recoverMissedInstallations } from "../../../../../server/github/recover-installations";
import { REFRESH_RETURN_PATH, decodeRefreshState } from "../../../../../server/github/refresh-return-state";
import { completeRefreshCallback } from "../../../../../server/github/complete-refresh-callback";
import { refreshInstallationFromGithub } from "../../../../../server/github/refresh-installation";
import { mintInstallationToken } from "../../../../../server/github/app-client";

const SESSION_COOKIE = "jumphour_session";

// GitHub App user-to-server OAuth callback target (design.md Decision 1 /
// the "User-to-server token" row). GitHub redirects the signed-in user here
// with `code` and `state` after authorizing, or with `error` when sign-in
// is denied or cancelled. Exchanging `code` for a token and starting a
// session (task 3.4) delegates to completeOAuthSignIn, which never
// persists the raw GitHub access token — only the resolved identity.
//
// Task 8.4 gives this route a second caller: the Refresh action
// (../../refresh/route.ts) redirects here through GitHub precisely because
// this is the only point in the application that holds a user-to-server
// token, and the repository listing call requires one (design.md Decision
// 2). A callback whose `state` decodes as a refresh marker re-lists and
// re-discovers for the named installation and then redirects to the
// repository and discovery view (REFRESH_RETURN_PATH).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  let outcome: OAuthSignInOutcome;
  // Captured as a side effect of the injected exchangeCode below.
  // completeOAuthSignIn intentionally never returns the raw access token
  // (see oauth-session.ts) — only this closure sees it, so task 3.3's
  // GET /user/installations recovery and task 8.4's repository listing can
  // reuse the very token sign-in just exchanged instead of a second OAuth
  // round trip, without changing completeOAuthSignIn's contract or its
  // existing tests. It is never written to the database.
  let userAccessToken: string | null = null;
  try {
    const env = getEnv();
    outcome = await completeOAuthSignIn({
      code,
      error,
      driver: getDriver(),
      exchangeCode: async (oauthCode) => {
        if (!env.githubAppClientId || !env.githubAppClientSecret) {
          throw new Error("GitHub OAuth client credentials are not configured");
        }
        const token = await exchangeOAuthCode({
          clientId: env.githubAppClientId,
          clientSecret: env.githubAppClientSecret,
          code: oauthCode,
        });
        userAccessToken = token.accessToken;
        return token;
      },
      fetchGithubUser: (accessToken) => fetchGithubUser({ accessToken }),
    });
  } catch (err) {
    outcome = { signedIn: false, reason: err instanceof Error ? err.message : "unknown error" };
  }

  // Task 3.3 (recover a missed Setup redirect). A failure here (e.g. a
  // transient GitHub listing error) must not turn a successful sign-in into
  // a 500 — the page at / renders whatever is stored.
  let accessibleInstallationIds: number[] = [];
  if (outcome.signedIn && userAccessToken) {
    try {
      const recovered = await recoverMissedInstallations({
        accessToken: userAccessToken,
        driver: getDriver(),
        listInstallations: (accessToken) => fetchUserInstallations({ accessToken }),
      });
      accessibleInstallationIds = recovered.installations.map((i) => i.githubInstallationId);
    } catch {
      // Listing failure: the landing page renders whatever is stored.
    }
  }

  // Task 8.4: this round trip was a Refresh, not a plain sign-in.
  const refreshReturn = decodeRefreshState(state);
  if (outcome.signedIn && userAccessToken && refreshReturn) {
    await performRefresh({
      sessionId: outcome.sessionId,
      installationId: refreshReturn.installationId,
      accessibleInstallationIds,
      userAccessToken,
    });

    // Land the browser back on the repository and discovery view
    // (workflow-board-ui task 6.4), which re-renders from the rows the
    // refresh just overwrote — not on the board a plain sign-in lands on.
    const response = NextResponse.redirect(new URL(REFRESH_RETURN_PATH, request.url), { status: 303 });
    setSessionCookie(response, outcome.sessionId);
    return response;
  }

  if (outcome.signedIn) {
    // Design.md Decision 6: a plain sign-in lands on the application — the
    // workflow board at `/`. Only the refresh branch above returns to
    // REFRESH_RETURN_PATH.
    const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
    setSessionCookie(response, outcome.sessionId);
    return response;
  }

  // Design.md Decision 6: a denied, cancelled, or failed sign-in lands on a
  // fixed marker with no session cookie. The failure reason can carry an
  // internal error message, so it never leaves the server.
  return NextResponse.redirect(new URL("/?signin=failed", request.url), { status: 303 });
}

function setSessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Wires ../../../../../server/github/complete-refresh-callback.ts to this
 * host's real credentials and GitHub client. The decisions (re-bind the
 * session, refuse an unconfirmed installation, name each failure) live
 * there, unit-tested; this function only supplies the two injected
 * dependencies and discards the outcome — a Refresh that could not complete
 * still redirects to the surface, which renders whatever is stored
 * (design.md Decision 8's "retry/refresh", not a failure page).
 */
async function performRefresh(params: {
  sessionId: string;
  installationId: number;
  accessibleInstallationIds: readonly number[];
  userAccessToken: string;
}): Promise<void> {
  const driver = getDriver();
  const env = getEnv();

  await completeRefreshCallback({
    sessionId: params.sessionId,
    installationId: params.installationId,
    accessibleInstallationIds: params.accessibleInstallationIds,
    driver,
    mintInstallationToken: async (installationId) => {
      if (!env.githubAppId || !env.githubAppPrivateKey) {
        throw new Error("GitHub App credentials are not configured");
      }
      return mintInstallationToken({
        appId: env.githubAppId,
        privateKey: env.githubAppPrivateKey,
        installationId,
      });
    },
    refresh: ({ installationId, installationToken }) =>
      refreshInstallationFromGithub({
        installationId,
        driver,
        userAccessToken: params.userAccessToken,
        installationToken,
      }),
  });
}
