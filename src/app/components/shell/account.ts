// Task 8.3 (specs/app-shell/spec.md "Identify the signed-in account and offer
// sign out"; design.md invariant sweep, "Signed-in account label"): the
// server-side read behind the account menu. The login comes from the stored
// user row through `getUser()`; a missing row yields `null`, which the menu
// renders as a neutral label — never the numeric user id, never a name.
import type { SqlDriver } from "../../../server/db/types";
import { getUser } from "../../../server/db/users";

export interface AccountView {
  /** The signed-in GitHub login, or null when the user row cannot be read. */
  login: string | null;
}

export const UNKNOWN_ACCOUNT: AccountView = { login: null };

export function resolveAccount(driver: SqlDriver, githubUserId: number): AccountView {
  return { login: getUser(driver, githubUserId)?.login ?? null };
}
