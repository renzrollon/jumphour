// Task 3.4: complete GitHub App OAuth sign-in and create a session bound to
// `github_user_id` — see specs/github-app-installation/spec.md
// "Authenticate users with GitHub identity". `exchangeCode` and
// `fetchGithubUser` are injected so a denied/cancelled callback can be
// proven to touch neither GitHub nor the database, and so a successful
// sign-in can be tested without a live GitHub OAuth exchange — see
// ./oauth-session.test.ts.
//
// The session row (schema: `sessions.id`, `github_user_id`,
// `installation_id`) never stores the GitHub access token itself; only the
// resolved identity survives past this function. There is no
// token-storage table in this schema (design.md Decision 7), so "stores no
// token" holds by construction on every path, not only the denied one.
import { randomUUID } from "node:crypto";
import type { SqlDriver } from "../db/types";
import { upsertUser } from "../db/users";

export interface CompleteOAuthSignInParams {
  /** Raw `code` query value, or null if absent (cancelled before authorizing). */
  code: string | null;
  /** Raw `error` query value GitHub sends when sign-in is denied, or null. */
  error: string | null;
  driver: SqlDriver;
  exchangeCode: (code: string) => Promise<{ accessToken: string }>;
  fetchGithubUser: (accessToken: string) => Promise<{ githubUserId: number; login: string }>;
  /** Test seam: deterministic session ids instead of a random UUID. */
  generateSessionId?: () => string;
}

export type OAuthSignInOutcome =
  | { signedIn: true; sessionId: string; githubUserId: number }
  | { signedIn: false; reason: string };

export async function completeOAuthSignIn(params: CompleteOAuthSignInParams): Promise<OAuthSignInOutcome> {
  const { code, error, driver, exchangeCode, fetchGithubUser } = params;
  const generateSessionId = params.generateSessionId ?? randomUUID;

  if (error) {
    return { signedIn: false, reason: `GitHub OAuth denied or cancelled: ${error}` };
  }
  if (!code) {
    return { signedIn: false, reason: "missing OAuth code" };
  }

  const { accessToken } = await exchangeCode(code);
  const identity = await fetchGithubUser(accessToken);

  const sessionId = generateSessionId();
  driver.transaction(() => {
    upsertUser(driver, { githubUserId: identity.githubUserId, login: identity.login });
    // `installation_id` starts null: a signed-in user may belong to zero,
    // one, or several installations, and picking one is task 3.3/3.5's
    // concern, not sign-in's.
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, NULL)`, [
      sessionId,
      identity.githubUserId,
    ]);
  });

  return { signedIn: true, sessionId, githubUserId: identity.githubUserId };
}
