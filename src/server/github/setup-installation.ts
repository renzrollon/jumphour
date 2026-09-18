// Task 3.2: persist an installation from the GitHub App Setup URL redirect.
// GitHub's Setup URL query carries only `installation_id` and
// `setup_action` (design.md Decision 1) — no account id/login — so this
// module resolves the account via `fetchInstallationAccount` (task 3.1's
// App-JWT `GET /app/installations/{id}`, a read) before writing the
// `installations` row via the existing upsert (task 2.2).
//
// `fetchInstallationAccount` is injected so tests can record an
// installation without calling any GitHub API, write or otherwise — see
// ./setup-installation.test.ts.
import type { SqlDriver } from "../db/types";
import { upsertInstallation } from "../db/installations";

export interface InstallationAccountLookup {
  (installationId: number): Promise<{
    accountId: number;
    accountLogin: string;
    permissions?: Record<string, string> | null;
  }>;
}

export interface RecordInstallationFromSetupParams {
  /** Raw `installation_id` query value, or null if absent. */
  installationIdParam: string | null;
  /** Raw `setup_action` query value, or null if absent. */
  setupAction: string | null;
  driver: SqlDriver;
  fetchInstallationAccount: InstallationAccountLookup;
}

export type RecordInstallationOutcome =
  | { recorded: true; githubInstallationId: number }
  | { recorded: false; reason: string };

/** GitHub's own Setup URL `setup_action` values: `install` and `update`
 * carry a real, active installation. `request` is sent when a non-admin
 * organization member requests an install that an owner has not approved
 * yet — no installation exists to record. See GitHub's "Approving
 * installation requests" docs. */
const NO_INSTALLATION_YET_ACTIONS = new Set(["request"]);

/**
 * Persists (upserts) the `installations` row named by the Setup URL's
 * `installation_id`, resolving its account via `fetchInstallationAccount`.
 * Never calls a GitHub write endpoint — the only GitHub interaction is the
 * injected read.
 */
export async function recordInstallationFromSetup(
  params: RecordInstallationFromSetupParams,
): Promise<RecordInstallationOutcome> {
  const { installationIdParam, setupAction, driver, fetchInstallationAccount } = params;

  if (!installationIdParam) {
    return { recorded: false, reason: "missing installation_id" };
  }

  const githubInstallationId = Number(installationIdParam);
  if (!Number.isInteger(githubInstallationId) || githubInstallationId <= 0) {
    return { recorded: false, reason: "invalid installation_id" };
  }

  if (setupAction && NO_INSTALLATION_YET_ACTIONS.has(setupAction)) {
    return { recorded: false, reason: `setup_action "${setupAction}" is not an active installation yet` };
  }

  const account = await fetchInstallationAccount(githubInstallationId);

  upsertInstallation(driver, {
    githubInstallationId,
    accountId: account.accountId,
    accountLogin: account.accountLogin,
    permissionSnapshot: account.permissions ? JSON.stringify(account.permissions) : null,
  });

  return { recorded: true, githubInstallationId };
}
