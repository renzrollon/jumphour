// Task 5.1: specs/github-app-installation/spec.md "Fail closed when required
// GitHub permissions are missing". `fetchInstallationAccount` (task 3.1)
// already reads `GET /app/installations/{id}` and returns GitHub's raw
// `permissions` snapshot verbatim; this module is the interpretation that
// comment deferred to task 5.1 — compare that snapshot against the three
// permissions design.md Decision 5 requests, `metadata: read`,
// `contents: write`, `pull_requests: write`, and name the first one that
// falls short so a caller can report the gap by name rather than a generic
// "not authorized", and never attempt a compensating GitHub write.
import { fetchInstallationAccount, type GithubAppCredentials } from "./app-client";
import type { Clock } from "./app-jwt";
import type { GithubRequestFn } from "./request";
import { upsertInstallation } from "../db/installations";
import type { SqlDriver } from "../db/types";

type PermissionAccessLevel = "read" | "write" | "admin";

/** GitHub App repository permission values are hierarchical: `write`
 * satisfies a `read` requirement and `admin` satisfies both. Absent or
 * `none` satisfies neither. */
const ACCESS_LEVEL_RANK: Record<string, number> = {
  none: 0,
  read: 1,
  write: 2,
  admin: 3,
};

interface RequiredPermission {
  name: string;
  access: PermissionAccessLevel;
}

/** The exact set design.md Decision 5 ("Request write permissions at
 * install; perform zero writes") requests at install. `contents: write` and
 * `pull_requests: write` are unused by this change (CLAUDE.md "GitHub
 * access") but are still required here, so an installation that never
 * granted them fails closed now instead of silently degrading a later
 * Promote change. */
export const REQUIRED_INSTALLATION_PERMISSIONS: readonly RequiredPermission[] = [
  { name: "metadata", access: "read" },
  { name: "contents", access: "write" },
  { name: "pull_requests", access: "write" },
];

export type PermissionCheckResult =
  | { sufficient: true }
  | { sufficient: false; missingPermission: string; reason: string };

/**
 * Compares a raw GitHub `permissions` snapshot (or `null`, if GitHub sent
 * none) against `REQUIRED_INSTALLATION_PERMISSIONS`, in order, and returns
 * the first permission that falls short, named exactly as GitHub names it
 * (e.g. `"contents"`). Pure and synchronous — no GitHub call — so a caller
 * holding an already-fetched or stored snapshot (a later task's revoke
 * recheck, for instance) can check it without re-reading GitHub.
 */
export function checkInstallationPermissions(permissions: Record<string, string> | null): PermissionCheckResult {
  for (const required of REQUIRED_INSTALLATION_PERMISSIONS) {
    const granted = permissions?.[required.name];
    const grantedRank = granted ? (ACCESS_LEVEL_RANK[granted] ?? 0) : 0;
    const requiredRank = ACCESS_LEVEL_RANK[required.access];

    if (grantedRank < requiredRank) {
      return {
        sufficient: false,
        missingPermission: required.name,
        reason: granted
          ? `installation grants "${required.name}: ${granted}" but "${required.name}: ${required.access}" is required`
          : `installation does not grant required permission "${required.name}: ${required.access}"`,
      };
    }
  }

  return { sufficient: true };
}

export interface FetchInstallationPermissionStatusParams extends GithubAppCredentials {
  installationId: number;
  clock?: Clock;
  /** Test seam: same injected request function `fetchInstallationAccount`
   * accepts, so tests never reach the network. */
  request?: GithubRequestFn;
}

/**
 * Reads `GET /app/installations/{id}` (via `fetchInstallationAccount`, App
 * JWT-authenticated) and checks the result against
 * `REQUIRED_INSTALLATION_PERMISSIONS`. This is the read-then-require path
 * the task asks for; `checkInstallationPermissions` stays exported
 * separately for callers that already hold a snapshot.
 */
export async function fetchInstallationPermissionStatus(
  params: FetchInstallationPermissionStatusParams,
): Promise<PermissionCheckResult> {
  const account = await fetchInstallationAccount(params);
  return checkInstallationPermissions(account.permissions);
}

export interface RecheckInstallationPermissionsParams extends FetchInstallationPermissionStatusParams {
  /** Driver for the `installations` table row this installation already has
   * (task 2.2's upsert). Required — a recheck's entire point is to persist
   * what it found. */
  driver: SqlDriver;
}

/**
 * Task 5.2: re-reads `GET /app/installations/{id}` and OVERWRITES the stored
 * `permission_snapshot` with whatever GitHub reports now — including a
 * revoke. A prior stored snapshot that was `sufficient` must never survive a
 * later check that finds a permission gone; `upsertInstallation` replaces
 * the row's `permission_snapshot` column unconditionally (task 2.2), so
 * there is no merge or "keep the better of the two" path here — the newest
 * GitHub read always wins. Returns the freshly computed result so a caller
 * gets the current gap (if any) without a second read of what it just
 * stored.
 */
export async function recheckInstallationPermissions(
  params: RecheckInstallationPermissionsParams,
): Promise<PermissionCheckResult> {
  const { driver, installationId, ...credentials } = params;
  const account = await fetchInstallationAccount({ installationId, ...credentials });

  upsertInstallation(driver, {
    githubInstallationId: installationId,
    accountId: account.accountId,
    accountLogin: account.accountLogin,
    permissionSnapshot: account.permissions ? JSON.stringify(account.permissions) : null,
  });

  return checkInstallationPermissions(account.permissions);
}
