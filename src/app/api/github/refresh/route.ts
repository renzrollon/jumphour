import { NextResponse } from "next/server";
import { getDriver } from "../../../../server/db";
import { getEnv } from "../../../../server/env";
import { getSession } from "../../../../server/db/sessions";
import { buildGithubSignInUrl } from "../../../../server/github/sign-in-url";
import { REFRESH_RETURN_PATH, encodeRefreshState } from "../../../../server/github/refresh-return-state";

const SESSION_COOKIE = "jumphour_session";
const OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";

// Task 8.4: the signed-in surface's "Refresh" action (design.md Decision 8
// "retry/refresh"; Decision 6 "Refresh on explicit user refresh ... on
// refresh, overwrite the report"). A plain HTML form POST (see
// ../../../repositories/page.tsx) — no client JS.
//
// Refresh must re-run LISTING as well as discovery, and listing is
// `GET /user/installations/{id}/repositories`, which design.md Decision 2
// binds to the signed-in user's own user-to-server token. design.md
// Decision 7 names no token-storage table, so this request does not have
// one and cannot mint one: an installation token authenticates as the App,
// not as the user, and using it for the listing call would show a user every
// private repository in the installation.
//
// So this route does not perform the refresh itself. It redirects through
// GitHub's OAuth authorize endpoint to acquire a fresh user token, carrying
// the current installation in `state` (../../../../server/github/
// refresh-return-state.ts), and ../oauth/callback/route.ts performs the
// listing + discovery when GitHub sends the user back. Where the user still
// has a live GitHub session and has already authorized this App, GitHub
// returns immediately and the round trip is invisible.
//
// Reads the session cookie directly off the raw `Cookie` header rather than
// `cookies()` from "next/headers": that helper needs the Next.js
// request-scoped context Route Handlers get only when invoked through
// Next's own router, which this route's own tests (calling the exported
// POST directly, same convention as ../oauth/callback/route.test.ts and
// ../setup/route.test.ts) do not provide.
export const dynamic = "force-dynamic";

function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return null;
}

export async function POST(request: Request) {
  const driver = getDriver();
  const sessionId = readSessionCookie(request);
  const session = sessionId ? getSession(driver, sessionId) : undefined;
  // workflow-board-ui task 6.4: every early exit returns to the repository
  // and discovery view, never the board.
  const surface = new URL(REFRESH_RETURN_PATH, request.url);

  // No session, or no installation selected: there is nothing to refresh
  // and nothing to name in `state`. Land back on the surface, which already
  // renders the right empty-state copy (tasks 8.1 / 8.2) — or, with no
  // session, redirects on to the sign-in view at `/`.
  if (!session || session.installationId === null) {
    return NextResponse.redirect(surface, { status: 303 });
  }

  const env = getEnv();
  if (!env.githubAppClientId) {
    // OAuth is not configured, so no user token can be obtained and the
    // listing call is impossible. Redirect rather than error: Refresh is a
    // convenience on a page that already renders stored rows.
    return NextResponse.redirect(surface, { status: 303 });
  }

  const redirectUri = new URL(OAUTH_CALLBACK_PATH, request.url).toString();
  const authorizeUrl = buildGithubSignInUrl({
    clientId: env.githubAppClientId,
    redirectUri,
    state: encodeRefreshState(session.installationId),
  });

  return NextResponse.redirect(authorizeUrl, { status: 303 });
}
