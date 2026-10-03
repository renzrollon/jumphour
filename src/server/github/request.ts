// Shared GitHub REST request seam. Every GitHub App / OAuth flow in this
// change (JWT + installation-token minting in ./app-jwt and ./app-client,
// user-to-server calls in ./oauth) funnels its outgoing calls through the
// helpers here so CLAUDE.md's "GitHub access" rule holds in one place:
// every REST call sends `X-GitHub-Api-Version: 2026-03-10` and
// `Accept: application/vnd.github+json` — callers pass
// `...githubRequiredHeaders()` on every request rather than relying on a
// client library's own defaults, which are not guaranteed to match this
// exact version string.
import { Octokit } from "octokit";

export const GITHUB_API_VERSION = "2026-03-10";
export const GITHUB_ACCEPT_HEADER = "application/vnd.github+json";

/** The two headers CLAUDE.md requires on every GitHub REST call. Lowercase
 * keys, matching Octokit's own header convention. */
export function githubRequiredHeaders(): Record<string, string> {
  return {
    accept: GITHUB_ACCEPT_HEADER,
    "x-github-api-version": GITHUB_API_VERSION,
  };
}

/** Normalized shape of an outgoing GitHub REST call, decoupled from
 * Octokit's own (much wider) request signature so tests can inject a fake
 * implementation without constructing a real Octokit instance. */
export interface GithubRequestFn {
  (route: string, params?: Record<string, unknown>): Promise<{ data: unknown }>;
}

/**
 * Default production request function: a bare, unauthenticated Octokit
 * instance. This module's callers (App-JWT and user-token flows alike) pass
 * a bearer token via `params.headers.authorization` on every call rather
 * than configuring Octokit's own `auth` option, since a single shared
 * client here serves multiple distinct tokens (one per app installation or
 * signed-in user), not one fixed credential.
 */
export function createOctokitRequest(): GithubRequestFn {
  const client = new Octokit();
  return (route, params) => client.request(route, params);
}
