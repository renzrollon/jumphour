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
import { cookies, headers } from "next/headers";
import { getDriver } from "../server/db";
import { getEnv } from "../server/env";
import { getSession } from "../server/db/sessions";
import { listInstallationRepositories } from "../server/db/installation-repositories";
import { listDiscoveryReports } from "../server/db/discovery-reports";
import { buildRepositoryTableRows } from "../server/github/repository-table-view";
import { buildGithubSignInUrl } from "../server/github/sign-in-url";
import { resolveRepositoryListEmptyState } from "../server/github/repository-list-empty-state";
import { RepositoryTable } from "./components/repository-table";
import { InstallationPicker } from "./components/installation-picker";
import { SignInLink } from "./components/sign-in-link";

const SESSION_COOKIE = "jumphour_session";
const OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";

export default async function HomePage() {
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
      <main>
        <h1>Jumphour</h1>
        {env.githubAppClientId ? (
          <SignInLink href={buildGithubSignInUrl({ clientId: env.githubAppClientId, redirectUri })} />
        ) : (
          <p>GitHub OAuth is not configured.</p>
        )}
      </main>
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

  return (
    <main>
      <h1>Jumphour</h1>
      <InstallationPicker installations={[]} currentInstallationId={session.installationId} />
      {emptyStateExplanation ? <p>{emptyStateExplanation}</p> : null}
      <RepositoryTable rows={rows} />
      {session.installationId !== null ? (
        <form action="/api/github/refresh" method="post">
          <button type="submit">Refresh</button>
        </form>
      ) : null}
    </main>
  );
}
