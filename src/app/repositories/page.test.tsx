// workflow-board-ui task 6.2 (specs/github-app-installation/spec.md "Present
// a thin signed-in repository and discovery surface", as MODIFIED): the
// repository and discovery view moved from `/` to `/repositories`. These are
// the signed-in surface's tests from the pre-board src/app/page.test.tsx
// (design-system-and-app-shell task 9.1), unchanged except for the page they
// render: the stored rows inside the shell, tenancy, both empty states, the
// Refresh form, and no board lane title anywhere. A signed-out visitor is
// redirected to `/`.
// The real page runs against a real migrated SQLite file; only Next's request
// APIs (`next/headers`) and the appearance server actions are stubbed.
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

vi.mock("../components/shell/appearance-actions", () => ({
  setThemePreference: vi.fn(),
  setCatsPreference: vi.fn(),
}));

import { getDriver, resetDriverForTests } from "../../server/db";
import { runMigrations } from "../../server/db/migrate";
import { upsertInstallation } from "../../server/db/installations";
import { upsertUser } from "../../server/db/users";
import { upsertInstallationRepository } from "../../server/db/installation-repositories";
import { upsertDiscoveryReport } from "../../server/db/discovery-reports";
import { NO_ACCESSIBLE_REPOSITORIES_EXPLANATION } from "../../server/github/repository-list-empty-state";
import { INSTALLATION_REQUIRED_EXPLANATION } from "../../server/github/signed-in-surface";
import { LANES } from "../../lib/board/lanes";
import RepositoriesPage from "./page";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");
const BOARD_COLUMNS = ["Idea", "OpenSpec change", "In progress", "PR/MR"];
const LANE_SUBLABELS = Object.values(LANES).map((lane) => lane.sublabel);

const savedEnv = { DATABASE_PATH: process.env.DATABASE_PATH, GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID };
let tmpDir: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-repositories-page-"));
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

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await RepositoriesPage());
}

describe("RepositoriesPage — signed-in surface inside the shell", () => {
  it("renders the stored rows inside the shell, labelled with the installation and user", async () => {
    seedInstallation(7, "acme");
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 101, fullName: "acme/api-gateway" });
    upsertDiscoveryReport(getDriver(), {
      installationId: 7,
      githubRepoId: 101,
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
    });
    signIn(7);

    const html = await renderPage();

    expect(html).toContain('data-shell-region="app-shell"');
    expect(html.match(/<header/g)).toHaveLength(1);
    expect(html).toContain("acme");
    expect(html).toContain("octocat");
    expect(html).toContain("acme/api-gateway");
    expect(html).toContain("main");
    expect(html).toMatch(/<form[^>]*action="\/api\/github\/refresh"[^>]*method="post"/);
    expect(html).toContain("Refresh");
  });

  it("shows only the session installation's rows, never another installation's", async () => {
    seedInstallation(7, "acme");
    seedInstallation(8, "beta-org");
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 101, fullName: "acme/api-gateway" });
    upsertInstallationRepository(getDriver(), { installationId: 8, githubRepoId: 201, fullName: "beta-org/secret" });
    signIn(7);

    const html = await renderPage();

    expect(html).toContain("acme/api-gateway");
    expect(html).not.toContain("beta-org/secret");
  });

  it("keeps the installation-required empty state and offers no Refresh without an installation", async () => {
    signIn(null);

    const html = await renderPage();

    expect(html).toContain('data-shell-region="app-shell"');
    expect(html).toContain(INSTALLATION_REQUIRED_EXPLANATION);
    expect(html).toContain("No installation");
    expect(html).not.toContain("/api/github/refresh");
  });

  it("keeps the no-accessible-repositories empty state for an installation with zero rows", async () => {
    seedInstallation(7, "acme");
    signIn(7);

    const html = await renderPage();

    expect(html).toContain(NO_ACCESSIBLE_REPOSITORIES_EXPLANATION);
    expect(html).not.toMatch(/<td/);
    expect(html).toContain('action="/api/github/refresh"');
  });

  it("renders no Idea / OpenSpec change / In progress / PR/MR column string anywhere in the shell", async () => {
    seedInstallation(7, "acme");
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 101, fullName: "acme/api-gateway" });
    upsertInstallationRepository(getDriver(), { installationId: 7, githubRepoId: 102, fullName: "acme/legacy" });
    upsertDiscoveryReport(getDriver(), {
      installationId: 7,
      githubRepoId: 102,
      status: "unsupported",
      defaultBranch: "main",
      tipSha: "def456",
      reason: "openspec/config.yaml was not found on main",
    });
    signIn(7);

    const html = await renderPage();

    for (const column of BOARD_COLUMNS) {
      expect(html).not.toContain(column);
    }
    for (const sublabel of LANE_SUBLABELS) {
      expect(html).not.toContain(sublabel);
    }
  });

  it("marks Repositories as the current navigation item", async () => {
    seedInstallation(7, "acme");
    signIn(7);

    const html = await renderPage();

    expect(html).toMatch(/<a href="\/repositories" [^>]*aria-current="page"[^>]*>Repositories<\/a>/);
    expect(html).not.toMatch(/<a href="\/" [^>]*aria-current/);
  });

  it("leaves the shell's search slot empty", async () => {
    seedInstallation(7, "acme");
    signIn(7);

    const html = await renderPage();

    expect(html).toMatch(/<div[^>]*data-shell-slot="search"[^>]*><\/div>/);
  });
});

describe("RepositoriesPage — signed out", () => {
  it("redirects a visitor with no session to /", async () => {
    await expect(RepositoriesPage()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;[a-z]+;\/;/) });
  });

  it("redirects a visitor whose session cookie names no stored session to /", async () => {
    request.cookies.set("jumphour_session", "no-such-session");
    await expect(RepositoriesPage()).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;[a-z]+;\/;/) });
  });
});
