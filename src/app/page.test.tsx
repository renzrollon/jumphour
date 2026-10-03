// workflow-board-ui task 6.1 (specs/workflow-board/spec.md "Present a fixed
// four-lane projection board", failure "no installation is bound to the
// session"): a signed-in visitor to `/` gets the workflow board built by
// buildBoardView, scoped to the session's installation; without an
// installation, an explanation and a link to the repository view instead of
// lanes. The repository and discovery surface's own tests moved with it to
// ./repositories/page.test.tsx (task 6.2).
// design-system-and-app-shell task 9.2 (specs/app-shell/spec.md "Offer
// GitHub sign-in on a signed-out view" and "Land a completed sign-in on the
// signed-in surface"): the signed-out view's three states — configured, not
// configured, and `?signin=failed` — the last with a fixed notice that
// carries nothing from the request or the configuration. Unchanged by 6.1.
// The real page runs against a real migrated SQLite file; only Next's request
// APIs (`next/headers`, `next/navigation`) and the appearance server actions
// are stubbed.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name)! } : undefined),
  }),
  headers: async () => ({ get: (name: string) => request.headers.get(name) ?? null }),
}));

// BoardScreen reads `?card=` through next/navigation, which has no router
// outside the App Router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./components/shell/appearance-actions", () => ({
  setThemePreference: vi.fn(),
  setCatsPreference: vi.fn(),
}));

import { getDriver, resetDriverForTests } from "../server/db";
import { runMigrations } from "../server/db/migrate";
import { upsertInstallation } from "../server/db/installations";
import { upsertUser } from "../server/db/users";
import { upsertInstallationRepository } from "../server/db/installation-repositories";
import { INSTALLATION_REQUIRED_EXPLANATION } from "../server/github/signed-in-surface";
import { IDEA_INTAKE_UNAVAILABLE_REASON } from "../server/board/board-view";
import { NOT_ENABLED_TITLE } from "./components/board/empty-board";
import {
  OAUTH_NOT_CONFIGURED_EXPLANATION,
  SIGN_IN_FAILED_DETAIL,
  SIGN_IN_FAILED_TITLE,
} from "./components/signed-out-view";
import HomePage from "./page";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");
const LANE_TITLES = ["OpenSpec change", "In progress", "PR/MR"];

const savedEnv = { DATABASE_PATH: process.env.DATABASE_PATH, GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID };
let tmpDir: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-page-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "jumphour.sqlite3");
  delete process.env.GITHUB_APP_CLIENT_ID;
  request.cookies.clear();
  request.headers.clear();
  resetDriverForTests();
  runMigrations(getDriver(), migrationsDir);
});

afterEach(() => {
  resetDriverForTests();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

function seedInstallation(id: number, login: string): void {
  upsertInstallation(getDriver(), { githubInstallationId: id, accountId: id * 10, accountLogin: login });
}

function signIn(installationId: number | null): void {
  upsertUser(getDriver(), { githubUserId: 1, login: "octocat" });
  getDriver().run("INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)", [
    "sess-1",
    1,
    installationId,
  ]);
  request.cookies.set("jumphour_session", "sess-1");
}

async function renderPage(searchParams: Record<string, string> = {}): Promise<string> {
  const element = await HomePage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(element);
}

describe("HomePage — signed-in board", () => {
  it("renders the board inside the shell from the provider, not the repository table", async () => {
    seedInstallation(7, "acme");
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 101, fullName: "acme/api-gateway" });
    signIn(7);

    const html = await renderPage();

    expect(html).toContain('data-shell-region="app-shell"');
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html).toContain("acme");
    expect(html).toContain("octocat");
    // Production intake is unavailable: the not-enabled board, with its reason visible.
    expect(html).toContain(NOT_ENABLED_TITLE);
    expect(html).toContain(IDEA_INTAKE_UNAVAILABLE_REASON);
    // The installation's repository is a filter option.
    expect(html).toContain("acme/api-gateway");
    // The repository and discovery surface lives on /repositories now.
    expect(html).not.toMatch(/<table/);
    expect(html).not.toContain("/api/github/refresh");
    expect(html).not.toContain(INSTALLATION_REQUIRED_EXPLANATION);
    // Task 6.3: Board is the current navigation item.
    expect(html).toMatch(/<a href="\/" [^>]*aria-current="page"[^>]*>Board<\/a>/);
    expect(html).not.toMatch(/<a href="\/repositories" [^>]*aria-current/);
  });

  it("offers only the session installation's repositories, never another installation's", async () => {
    seedInstallation(7, "acme");
    seedInstallation(8, "beta-org");
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 101, fullName: "acme/api-gateway" });
    upsertInstallationRepository(getDriver(), { installationId: 8, githubRepoId: 201, fullName: "beta-org/secret" });
    signIn(7);

    const html = await renderPage();

    expect(html).toContain("acme/api-gateway");
    expect(html).not.toContain("beta-org/secret");
  });

  it("explains that an installation is required and links to Repositories when none is bound", async () => {
    signIn(null);

    const html = await renderPage();

    expect(html).toContain('data-shell-region="app-shell"');
    expect(html).toContain(INSTALLATION_REQUIRED_EXPLANATION);
    expect(html).toMatch(/<a[^>]*href="\/repositories"[^>]*>Open Repositories<\/a>/);
    expect(html).toContain("No installation");
    expect(html).toMatch(/<a href="\/" [^>]*aria-current="page"[^>]*>Board<\/a>/);
    for (const title of LANE_TITLES) {
      expect(html).not.toContain(title);
    }
    expect(html).not.toContain(NOT_ENABLED_TITLE);
    expect(html).not.toContain("/api/github/refresh");
  });
});

const CLIENT_ID = "Iv1.testclientid";

function alertText(html: string): string {
  const match = html.match(/<div role="alert"[\s\S]*?<\/div><\/div>/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("HomePage — signed-out view", () => {
  it("offers exactly one GitHub sign-in action when OAuth is configured", async () => {
    process.env.GITHUB_APP_CLIENT_ID = CLIENT_ID;
    request.headers.set("host", "jumphour.test");

    const html = await renderPage();

    expect(html).toContain('data-shell-region="signed-out"');
    expect(html).not.toContain('data-shell-region="app-shell"');
    expect(html.match(/<a\s/g)).toHaveLength(1);
    expect(html).not.toMatch(/<button/);
    expect(html).toContain("Sign in with GitHub");
    expect(html).toContain("https://github.com/login/oauth/authorize");
    expect(html).not.toContain(OAUTH_NOT_CONFIGURED_EXPLANATION);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/<table/);
  });

  it("explains that GitHub OAuth is not configured and offers no sign-in action", async () => {
    const html = await renderPage();

    expect(html).toContain("GitHub OAuth is not configured");
    expect(html).toContain(OAUTH_NOT_CONFIGURED_EXPLANATION);
    expect(html).not.toMatch(/<a\s/);
    expect(html).not.toMatch(/<button/);
    expect(html).not.toContain("Sign in with GitHub");
    expect(html).not.toContain("GITHUB_APP_CLIENT_ID");
  });

  it("shows a fixed notice for ?signin=failed that carries no code, token, client id, or reason", async () => {
    process.env.GITHUB_APP_CLIENT_ID = CLIENT_ID;
    const html = await renderPage({
      signin: "failed",
      code: "oauth-code-123",
      access_token: "gho_secrettoken",
      reason: "internal: token exchange threw ECONNRESET",
      error_description: "The user has denied your application access.",
    });

    const notice = alertText(html);
    expect(notice).toContain(SIGN_IN_FAILED_TITLE);
    expect(notice).toContain(SIGN_IN_FAILED_DETAIL);
    for (const secret of [
      "oauth-code-123",
      "gho_secrettoken",
      CLIENT_ID,
      "ECONNRESET",
      "internal",
      "denied your application",
    ]) {
      expect(notice).not.toContain(secret);
    }
    // Nothing from the query string reaches anywhere on the page.
    for (const secret of ["oauth-code-123", "gho_secrettoken", "ECONNRESET", "denied your application"]) {
      expect(html).not.toContain(secret);
    }
    // The single sign-in action stays available to try again.
    expect(html.match(/<a\s/g)).toHaveLength(1);
  });

  it("shows no failure notice for any other signin value", async () => {
    const html = await renderPage({ signin: "ok" });

    expect(html).not.toContain(SIGN_IN_FAILED_TITLE);
    expect(html).not.toContain('role="alert"');
  });
});
