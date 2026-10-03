// Task 8.1: builds the GitHub App user-to-server OAuth "Sign in with
// GitHub" URL (design.md Decision 2, "User-to-server token" row: "How
// obtained: User sign-in"). This is GitHub's OAuth 2.0 authorize endpoint
// (`github.com/login/oauth/authorize`), not a REST API call under
// `api.github.com`, so CLAUDE.md's `X-GitHub-Api-Version` requirement does
// not apply here — same distinction ./oauth.ts#exchangeOAuthCode already
// draws for the token endpoint.
//
// Pure string-building only: no fetch, no redirect, no env access. The
// caller (src/app/page.tsx) resolves `clientId` from ../env and `redirectUri`
// from the incoming request so this module stays framework- and
// environment-agnostic and trivially testable.

const OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

export interface BuildGithubSignInUrlParams {
  clientId: string;
  /** Must exactly match a callback URL registered on the GitHub App —
   * docs/github-app-local-setup.md documents the local value
   * (`http://localhost:3000/api/github/oauth/callback`). */
  redirectUri: string;
  /** Opaque anti-CSRF value GitHub echoes back as `state` on the callback
   * (../../app/api/github/oauth/callback/route.ts already reads it). */
  state?: string;
}

/**
 * Builds the URL a "Sign in with GitHub" link points at. Always sets
 * `client_id` and `redirect_uri`; `state` is included only when the caller
 * supplies one.
 */
export function buildGithubSignInUrl(params: BuildGithubSignInUrlParams): string {
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  if (params.state) {
    url.searchParams.set("state", params.state);
  }
  return url.toString();
}
