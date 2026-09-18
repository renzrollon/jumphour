// Task 8.4: Refresh cannot re-list repositories with the credentials a
// plain POST has — listing needs the signed-in user's own user-to-server
// token (design.md Decision 2) and no token is persisted (Decision 7). So
// this route's whole job is to start an OAuth round trip that will end at
// ../oauth/callback/route.ts with a fresh user token, carrying the current
// installation across in `state`. These tests assert exactly that hand-off,
// and that every path that cannot start it still lands the user back on the
// signed-in surface rather than erroring.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDriver, resetDriverForTests } from "../../../../server/db";
import { runMigrations } from "../../../../server/db/migrate";
import { upsertInstallationRepository } from "../../../../server/db/installation-repositories";
import { decodeRefreshState } from "../../../../server/github/refresh-return-state";
import { POST } from "./route";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "migrations",
);

const savedEnv = {
  DATABASE_PATH: process.env.DATABASE_PATH,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
};
let tmpDir: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-refresh-route-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "jumphour.sqlite3");
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_APP_CLIENT_ID;
  resetDriverForTests();
  runMigrations(getDriver(), migrationsDir);
});

afterEach(() => {
  resetDriverForTests();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

function insertInstallation(id: number): void {
  const now = new Date().toISOString();
  getDriver().run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, 100, "acme", now, now],
  );
}

function insertSession(id: string, installationId: number | null): void {
  getDriver().run(`INSERT INTO users (github_user_id, login) VALUES (?, ?)`, [1, "octocat"]);
  getDriver().run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, [
    id,
    1,
    installationId,
  ]);
}

function refreshRequest(cookie?: string): Request {
  return new Request("http://localhost:3000/api/github/refresh", {
    method: "POST",
    ...(cookie ? { headers: { cookie } } : {}),
  });
}

describe("POST /api/github/refresh", () => {
  it("redirects to GitHub OAuth carrying the current installation, so the callback can re-list with a user token", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclientid";
    insertInstallation(7);
    insertSession("sess-1", 7);

    const response = await POST(refreshRequest("jumphour_session=sess-1"));

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("Iv1.testclientid");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/github/oauth/callback",
    );

    // The installation survives the round trip — without it the callback
    // would create a session with installation_id NULL and have nothing to
    // refresh.
    expect(decodeRefreshState(location.searchParams.get("state"))).toEqual({
      intent: "refresh",
      installationId: 7,
    });
  });

  it("redirects back to the signed-in surface with no session cookie", async () => {
    const response = await POST(refreshRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects to the surface, not to GitHub, when the session has no current installation", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclientid";
    insertInstallation(1);
    insertSession("sess-1", null);

    const response = await POST(refreshRequest("jumphour_session=sess-1"));

    expect(response.status).toBe(303);
    // There is nothing to name in `state`, so no OAuth trip is started.
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects to the surface when OAuth is not configured, and changes no stored row", async () => {
    insertInstallation(1);
    insertSession("sess-1", 1);
    upsertInstallationRepository(getDriver(), { installationId: 1, githubRepoId: 42, fullName: "acme/api-gateway" });

    const response = await POST(refreshRequest("jumphour_session=sess-1"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    const row = getDriver().get<{ full_name: string }>(
      "SELECT full_name FROM installation_repositories WHERE installation_id = ? AND github_repo_id = ?",
      [1, 42],
    );
    expect(row?.full_name).toBe("acme/api-gateway");
  });

  it("ignores an unknown session cookie and still redirects to the surface", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclientid";

    const response = await POST(refreshRequest("jumphour_session=does-not-exist"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("issues no GitHub API call of its own — the callback does the work", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclientid";
    insertInstallation(7);
    insertSession("sess-1", 7);

    // A route that reached GitHub here would have to use an installation
    // token (the only credential it can mint), which design.md Decision 2
    // forbids for the listing call. Redirecting is the whole point.
    const response = await POST(refreshRequest("jumphour_session=sess-1"));

    expect(new URL(response.headers.get("location")!).hostname).toBe("github.com");
  });
});
