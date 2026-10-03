// workflow-board-ui tasks 6.1–6.2: what every signed-in page reads from the
// request before it renders — the session named by the session cookie, and
// the shell's workspace, account, and appearance. Shared by the board (`/`)
// and the repository view (`/repositories`) so both resolve the session and
// label the shell identically. Reads stored rows only; never calls GitHub.
import { cookies } from "next/headers";
import { getDriver } from "../server/db";
import type { SqlDriver } from "../server/db/types";
import { getSession, type SessionRow } from "../server/db/sessions";
import { resolveWorkspace, type WorkspaceView } from "./components/shell/workspace";
import { resolveAccount, type AccountView } from "./components/shell/account";
import { CATS_COOKIE, THEME_COOKIE, parseAppearance, type Appearance } from "../lib/appearance/appearance";

export const SESSION_COOKIE = "jumphour_session";

export interface SignedInShell {
  workspace: WorkspaceView;
  account: AccountView;
  appearance: Appearance;
}

export interface SignedInRequest {
  driver: SqlDriver;
  session: SessionRow;
  shell: SignedInShell;
}

/** The signed-in session and shell labels, or `null` when no stored session matches the cookie. */
export async function readSignedInRequest(): Promise<SignedInRequest | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  if (!sessionId) return null;
  const driver = getDriver();
  const session = getSession(driver, sessionId);
  if (!session) return null;

  return {
    driver,
    session,
    shell: {
      workspace: resolveWorkspace(driver, session.installationId),
      account: resolveAccount(driver, session.githubUserId),
      appearance: parseAppearance({
        theme: cookieStore.get(THEME_COOKIE)?.value,
        cats: cookieStore.get(CATS_COOKIE)?.value,
      }),
    },
  };
}
