// GitHub App JWT-authenticated calls (task 3.1 / task 3.2). Two App-level
// operations, both authenticated with the App JWT from ./app-jwt (never an
// installation or user token):
//
//   - mintInstallationToken: `POST /app/installations/{id}/access_tokens`,
//     minting an installation access token. Later tasks (5.x permission
//     reads, 6.x discovery content reads) use its output; this change does
//     not call any GitHub write endpoint with it (CLAUDE.md "GitHub
//     access").
//   - fetchInstallationAccount: `GET /app/installations/{id}`, resolving the
//     account id/login (and raw permissions) for an installation. Task 3.2
//     uses this to fill in what the Setup URL redirect does not carry —
//     GitHub's query string is only `installation_id` + `setup_action`.
//
// Both are plain GET/POST reads of App metadata, not repository writes.
import { mintAppJwt, systemClock, type Clock } from "./app-jwt";
import { createOctokitRequest, githubRequiredHeaders, type GithubRequestFn } from "./request";

export interface GithubAppCredentials {
  appId: string;
  privateKey: string;
}

interface AppRequestParams extends GithubAppCredentials {
  installationId: number;
  clock?: Clock;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

function jwtBearerHeaders(jwt: string): Record<string, string> {
  return {
    authorization: `Bearer ${jwt}`,
    ...githubRequiredHeaders(),
  };
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
}

/** Mints a short-lived installation access token via
 * `POST /app/installations/{id}/access_tokens`, authenticated with the App
 * JWT. The outgoing call always carries CLAUDE.md's required headers. */
export async function mintInstallationToken(params: AppRequestParams): Promise<InstallationToken> {
  const { appId, privateKey, installationId, clock = systemClock } = params;
  const request = params.request ?? createOctokitRequest();

  const jwt = mintAppJwt({ appId, privateKey, clock });
  const response = await request("POST /app/installations/{installation_id}/access_tokens", {
    installation_id: installationId,
    headers: jwtBearerHeaders(jwt),
  });

  const data = response.data as { token: string; expires_at: string };
  return { token: data.token, expiresAt: data.expires_at };
}

export interface InstallationAccount {
  accountId: number;
  accountLogin: string;
  /** Raw `permissions` object from GitHub's response, or null if absent.
   * Task 3.2 stores this verbatim as the installation's permission
   * snapshot; interpreting it against required permissions is task 5.1. */
  permissions: Record<string, string> | null;
}

/** Reads `GET /app/installations/{id}`, authenticated with the App JWT, to
 * resolve the installation's account identity (and raw permission
 * snapshot). Used to complete a Setup URL redirect, which carries only
 * `installation_id`/`setup_action` and no account information. */
export async function fetchInstallationAccount(params: AppRequestParams): Promise<InstallationAccount> {
  const { appId, privateKey, installationId, clock = systemClock } = params;
  const request = params.request ?? createOctokitRequest();

  const jwt = mintAppJwt({ appId, privateKey, clock });
  const response = await request("GET /app/installations/{installation_id}", {
    installation_id: installationId,
    headers: jwtBearerHeaders(jwt),
  });

  const data = response.data as {
    account: { id: number; login: string } | null;
    permissions?: Record<string, string>;
  };
  if (!data.account) {
    throw new Error(`GitHub installation ${installationId} has no associated account`);
  }

  return {
    accountId: data.account.id,
    accountLogin: data.account.login,
    permissions: data.permissions ?? null,
  };
}
