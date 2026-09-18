// GitHub App user-to-server OAuth (task 3.4): exchange the callback `code`
// for a user access token, then resolve the signed-in GitHub identity.
// design.md Decision 2, "User-to-server token" row: "How obtained: User
// sign-in | Used for: Session identity; GET /user/installations; ...". This
// module never persists the access token itself — only the resolved
// identity is handed to ./oauth-session, which stores a session bound to
// `github_user_id`, not the token (see CLAUDE.md "GitHub access": secrets
// never enter git, and design.md names no token-storage table).
//
// fetchUserInstallations (task 3.3) and fetchUserInstallationRepositories
// (task 4.1) live here too, not in ./app-client: fetchGithubUser,
// fetchUserInstallations, and fetchUserInstallationRepositories all
// authenticate with the same signed-in user's bearer token, while
// app-client.ts's calls authenticate with the App JWT — a different
// credential for a different job (design.md Decision 2's table).
import { createOctokitRequest, githubRequiredHeaders, type GithubRequestFn } from "./request";

const OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";

export interface ExchangeOAuthCodeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  /** Test seam: inject a fake fetch so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

export interface OAuthAccessToken {
  accessToken: string;
}

/**
 * Exchanges an OAuth `code` for a user access token. This is GitHub's OAuth
 * 2.0 token endpoint (`github.com/login/oauth/access_token`), not a REST
 * API call under `api.github.com`, so it does not carry
 * `X-GitHub-Api-Version` (CLAUDE.md's REST-call header requirement does not
 * apply here); `Accept: application/json` is set instead so GitHub returns
 * JSON rather than its default form-encoded body.
 */
export async function exchangeOAuthCode(params: ExchangeOAuthCodeParams): Promise<OAuthAccessToken> {
  const fetchImpl = params.fetchImpl ?? fetch;

  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "GitHub OAuth token exchange failed");
  }

  return { accessToken: data.access_token };
}

export interface FetchGithubUserParams {
  accessToken: string;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

export interface GithubUserIdentity {
  githubUserId: number;
  login: string;
}

/** Reads `GET /user` with the signed-in user's own access token — the
 * user-to-server call design.md names for "Session identity". Always sends
 * CLAUDE.md's required REST headers. */
export async function fetchGithubUser(params: FetchGithubUserParams): Promise<GithubUserIdentity> {
  const request = params.request ?? createOctokitRequest();

  const response = await request("GET /user", {
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      ...githubRequiredHeaders(),
    },
  });

  const data = response.data as { id: number; login: string };
  return { githubUserId: data.id, login: data.login };
}

export interface GithubInstallationSummary {
  githubInstallationId: number;
  accountId: number;
  accountLogin: string;
  /** Raw `permissions` object from GitHub's response, or null if absent. */
  permissions: Record<string, string> | null;
}

export interface FetchUserInstallationsParams {
  accessToken: string;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

/**
 * Task 3.3: reads `GET /user/installations` with the signed-in user's own
 * access token — design.md Decision 2's "User-to-server token" row names
 * this call explicitly. GitHub itself computes the result as the
 * intersection of "installations of this App" and "installations this user
 * can access", so any id this returns that Jumphour has no `installations`
 * row for is exactly a Setup URL redirect the admin never completed (design
 * .md "Setup URL missed" risk) — not evidence of a fresh install (task 3.2
 * already owns that path). Always sends CLAUDE.md's required REST headers.
 *
 * An installation entry with no `account` (GitHub's enterprise-owned edge
 * case) is skipped rather than thrown on, so one malformed entry cannot
 * fail recovery for every other installation in the list.
 */
export async function fetchUserInstallations(
  params: FetchUserInstallationsParams,
): Promise<GithubInstallationSummary[]> {
  const request = params.request ?? createOctokitRequest();

  const response = await request("GET /user/installations", {
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      ...githubRequiredHeaders(),
    },
  });

  const data = response.data as {
    installations: Array<{
      id: number;
      account: { id: number; login: string } | null;
      permissions?: Record<string, string>;
    }>;
  };

  return data.installations
    .filter((installation) => installation.account !== null)
    .map((installation) => ({
      githubInstallationId: installation.id,
      accountId: installation.account!.id,
      accountLogin: installation.account!.login,
      permissions: installation.permissions ?? null,
    }));
}

export interface GithubInstallationRepository {
  githubRepoId: number;
  fullName: string;
}

export interface FetchUserInstallationRepositoriesParams {
  accessToken: string;
  installationId: number;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

/**
 * Task 4.1: reads `GET /user/installations/{installation_id}/repositories`
 * with the signed-in user's own access token — design.md Decision 2's
 * "User-to-server token" row names this call explicitly, and it is never
 * called with the installation access token, which would return every
 * repository the App installation covers regardless of this user's own
 * GitHub access (Decision 2: "Never used to show a user repositories they
 * cannot access"). GitHub itself computes the response as the intersection
 * of "repositories in this installation" and "repositories this user can
 * access" — specs/github-app-installation/spec.md's "List only
 * installation-scoped accessible repositories" requirement — so an
 * installation with two repositories where this user can reach only one
 * comes back as a one-repository list here, not two; see
 * ./oauth.test.ts's fixture for that exact case. Always sends CLAUDE.md's
 * required REST headers.
 */
export async function fetchUserInstallationRepositories(
  params: FetchUserInstallationRepositoriesParams,
): Promise<GithubInstallationRepository[]> {
  const request = params.request ?? createOctokitRequest();

  const response = await request("GET /user/installations/{installation_id}/repositories", {
    installation_id: params.installationId,
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      ...githubRequiredHeaders(),
    },
  });

  const data = response.data as {
    repositories: Array<{ id: number; full_name: string }>;
  };

  return data.repositories.map((repository) => ({
    githubRepoId: repository.id,
    fullName: repository.full_name,
  }));
}
