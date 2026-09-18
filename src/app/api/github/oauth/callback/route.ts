import { NextResponse } from "next/server";
import { getDriver } from "../../../../../server/db";
import { getEnv } from "../../../../../server/env";
import { exchangeOAuthCode, fetchGithubUser, fetchUserInstallations } from "../../../../../server/github/oauth";
import { completeOAuthSignIn, type OAuthSignInOutcome } from "../../../../../server/github/oauth-session";
import { recoverMissedInstallations } from "../../../../../server/github/recover-installations";
import { resolveSignedInSurface, type SignedInSurface } from "../../../../../server/github/signed-in-surface";
import { decodeRefreshState } from "../../../../../server/github/refresh-return-state";
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
// signed-in surface, instead of answering with the sign-in JSON body.
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

  // Task 3.3 (recover a missed Setup redirect) + task 3.5 (explain when
  // there is no overlap at all). A failure here (e.g. a transient GitHub
  // listing error) must not turn a successful sign-in into a 500 — it
  // leaves the surface at its zero-repositories default, same as "no
  // overlap yet", rather than inventing installations or crashing the
  // callback (task 4.3 owns a proper retryable-error surface).
  let surface: SignedInSurface = { repositories: [], explanation: null };
  let accessibleInstallationIds: number[] = [];
  if (outcome.signedIn && userAccessToken) {
    try {
      const recovered = await recoverMissedInstallations({
        accessToken: userAccessToken,
        driver: getDriver(),
        listInstallations: (accessToken) => fetchUserInstallations({ accessToken }),
      });
      accessibleInstallationIds = recovered.installations.map((i) => i.githubInstallationId);
      surface = resolveSignedInSurface({ overlappingInstallationCount: recovered.installations.length });
    } catch {
      // Listing failure: leave the default zero-repositories surface with
      // no explanation rather than guess at one (out of this task's scope).
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

    // Land the browser back on the signed-in surface, which re-renders from
    // the rows the refresh just overwrote.
    const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
    setSessionCookie(response, outcome.sessionId);
    return response;
  }

  const response = NextResponse.json({
    ok: true,
    route: "github-app-oauth-callback",
    codeReceived: Boolean(code),
    state,
    signedIn: outcome.signedIn,
    ...(outcome.signedIn
      ? { repositories: surface.repositories, ...(surface.explanation ? { explanation: surface.explanation } : {}) }
      : { reason: outcome.reason }),
  });

  if (outcome.signedIn) {
    setSessionCookie(response, outcome.sessionId);
  }

  return response;
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
