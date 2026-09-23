// Task 8.1: the "thin signed-in surface" (design.md Decision 8) — sign-in,
// an optional installation picker, and the repository/discovery table.
// Task 8.2 adds the empty-state copy (no installation selected, or an
// installation with zero accessible repositories) via
// ../server/github/repository-list-empty-state.ts. Task 8.3 needed no
// change here: RepositoryTable already structurally renders no
// Promote/create-PR/write-OpenSpec action for any row (see
// ./components/repository-table.tsx and its test). Task 8.4 adds the
// Refresh form, posting to ../api/github/refresh/route.ts.
//
// Reads only already-stored, installation-scoped rows (task 7.1's
// listInstallationRepositories / listDiscoveryReports) — never a live
// GitHub call on page load itself. That mirrors every route in this
// codebase: a signed-in user's OAuth access token is never persisted past
// ../server/github/oauth-session.ts#completeOAuthSignIn (design.md Decision
// 7 names no token-storage table), so there is no stored credential a page
// render could use to call GitHub live even if design intended it to. The
// Refresh form below is the one place this page can trigger a live GitHub
// read: task 8.4's route answers it with a redirect through GitHub OAuth,
// which is how the refresh obtains the user-to-server token the repository
// listing call requires (design.md Decision 2) without ever storing one —
// see ../api/github/refresh/route.ts and
// ../server/github/refresh-return-state.ts.
//
// The installation picker therefore always receives a single-installation
// (or empty) list here and renders nothing (see ./components/installation-
// picker.tsx): enumerating "every installation this signed-in user belongs
// to" for a real multi-installation picker needs a live `GET
// /user/installations` call (task 3.3's shape) or a stored per-user
// membership set, neither available on a plain page load with today's
// schema (migrations/0001_core_schema.sql has no such table). That data
// source is undecided, not guessed here — task 7.2's switchCurrentInstallation
// already exists as the backend half once a caller supplies that list.
//
// design-system-and-app-shell task 9.1 (specs/app-shell/spec.md "Preserve the
// repository and discovery surface inside the shell"): the signed-in body
// now renders as ./components/repository-surface.tsx inside the AppShell,
// which receives the workspace label (resolveWorkspace over the session's
// installation), the account label (resolveAccount over the session's user)
// and the server-read appearance. Row selection, the empty-state copy and the
// Refresh target are computed here exactly as before and handed through.
//
// Task 9.2: the signed-out branch renders ./components/signed-out-view.tsx.
// Only the `signin` query key is read, and only compared against the fixed
// "failed" marker — no other query value reaches the rendered view.
import { cookies, headers } from "next/headers";
import { getDriver } from "../server/db";
import { getEnv } from "../server/env";
import { getSession } from "../server/db/sessions";
import { listInstallationRepositories } from "../server/db/installation-repositories";
import { listDiscoveryReports } from "../server/db/discovery-reports";
import { buildRepositoryTableRows } from "../server/github/repository-table-view";
import { buildGithubSignInUrl } from "../server/github/sign-in-url";
import { resolveRepositoryListEmptyState } from "../server/github/repository-list-empty-state";
import { SignedOutView } from "./components/signed-out-view";
import { RepositorySurface } from "./components/repository-surface";
import { AppShell } from "./components/shell/app-shell";
import { resolveWorkspace } from "./components/shell/workspace";
import { resolveAccount } from "./components/shell/account";
import { CATS_COOKIE, THEME_COOKIE, parseAppearance } from "../lib/appearance/appearance";

const SESSION_COOKIE = "jumphour_session";
const OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
/** design.md Decision 6: the OAuth callback's failure landing is `/?signin=failed`. */
const SIGN_IN_FAILED_MARKER = "failed";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const session = sessionId ? getSession(getDriver(), sessionId) : undefined;

  if (!session) {
    const env = getEnv();
    const headerList = await headers();
    const host = headerList.get("host") ?? "localhost:3000";
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    const redirectUri = `${proto}://${host}${OAUTH_CALLBACK_PATH}`;

    return (
      <SignedOutView
        signInHref={
          env.githubAppClientId ? buildGithubSignInUrl({ clientId: env.githubAppClientId, redirectUri }) : null
        }
        signInFailed={firstValue(params.signin) === SIGN_IN_FAILED_MARKER}
      />
    );
  }

  const driver = getDriver();
  const rows =
    session.installationId === null
      ? []
      : buildRepositoryTableRows(
          listInstallationRepositories(driver, session.installationId),
          listDiscoveryReports(driver, session.installationId),
        );
  const emptyStateExplanation = resolveRepositoryListEmptyState({
    installationId: session.installationId,
    rowCount: rows.length,
  });

  const appearance = parseAppearance({
    theme: cookieStore.get(THEME_COOKIE)?.value,
    cats: cookieStore.get(CATS_COOKIE)?.value,
  });

  return (
    <AppShell
      workspace={resolveWorkspace(driver, session.installationId)}
      account={resolveAccount(driver, session.githubUserId)}
      appearance={appearance}
    >
      <RepositorySurface
        installationId={session.installationId}
        rows={rows}
        emptyStateExplanation={emptyStateExplanation}
      />
    </AppShell>
  );
}
