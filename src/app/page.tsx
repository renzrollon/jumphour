// workflow-board-ui task 6.1 (specs/workflow-board/spec.md "Present a fixed
// four-lane projection board"; design.md Decisions 3 and 9): the signed-in
// landing view is the workflow board. This page stays a server component:
// it reads the session, asks the one production provider
// (../server/board/board-view.ts#buildBoardView) for the `BoardViewModel`,
// and hands it to the client `BoardScreen`. Nothing here derives a lane, a
// listener state, or an availability.
//
// When the provider reports no installation (the session has none bound, or
// names one with no stored row), no lanes and no cards are shown: the view
// explains that a GitHub App installation is required — the same
// INSTALLATION_REQUIRED_EXPLANATION the repository view uses — and links to
// the repository view (spec failure "no installation is bound to the
// session").
//
// The repository and discovery surface that used to live here moved,
// unchanged, to ./repositories/page.tsx (task 6.2). Both signed-in branches
// mark Board as the current navigation item (task 6.3).
//
// design-system-and-app-shell task 9.2: the signed-out branch renders
// ./components/signed-out-view.tsx. Only the `signin` query key is read, and
// only compared against the fixed "failed" marker — no other query value
// reaches the rendered view. This branch is unchanged by the board.
import { headers } from "next/headers";
import { getEnv } from "../server/env";
import { buildBoardView } from "../server/board/board-view";
import { buildGithubSignInUrl } from "../server/github/sign-in-url";
import { INSTALLATION_REQUIRED_EXPLANATION } from "../server/github/signed-in-surface";
import { SignedOutView } from "./components/signed-out-view";
import { AppShell } from "./components/shell/app-shell";
import { BoardScreen } from "./components/board/board-screen";
import { readSignedInRequest } from "./signed-in-request";
import styles from "./page.module.css";

const OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
/** design.md Decision 6: the OAuth callback's failure landing is `/?signin=failed`. */
const SIGN_IN_FAILED_MARKER = "failed";
/** The repository and discovery view (task 6.2). */
const REPOSITORIES_PATH = "/repositories";
const INSTALLATION_REQUIRED_TITLE = "A GitHub App installation is required";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const signedIn = await readSignedInRequest();

  if (!signedIn) {
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

  const { driver, session, shell } = signedIn;
  const view = buildBoardView(driver, session, new Date());

  if (view.installation === null) {
    return (
      <AppShell {...shell} currentNav="board">
        <section className={styles.installationRequired} aria-labelledby="installation-required-title">
          <h1 id="installation-required-title" className={styles.title}>
            {INSTALLATION_REQUIRED_TITLE}
          </h1>
          <p className={styles.body}>{INSTALLATION_REQUIRED_EXPLANATION}</p>
          <a className={styles.link} href={REPOSITORIES_PATH}>
            Open Repositories
          </a>
        </section>
      </AppShell>
    );
  }

  return <BoardScreen view={view} shell={{ ...shell, currentNav: "board" }} />;
}
