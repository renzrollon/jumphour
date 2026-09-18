import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDriver, resetDriverForTests } from "../../../../../server/db";
import { runMigrations } from "../../../../../server/db/migrate";
import { GET } from "./route";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "migrations",
);

const savedEnv = {
  DATABASE_PATH: process.env.DATABASE_PATH,
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET,
};
let tmpDir: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-oauth-route-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "jumphour.sqlite3");
  delete process.env.GITHUB_APP_CLIENT_ID;
  delete process.env.GITHUB_APP_CLIENT_SECRET;
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

function countSessions(): number {
  return getDriver().get<{ n: number }>("SELECT COUNT(*) AS n FROM sessions")!.n;
}

describe("GET /api/github/oauth/callback", () => {
  it("responds without requiring Marketplace listing, echoing code/state", async () => {
    const request = new Request(
      "http://localhost:3000/api/github/oauth/callback?code=abc&state=xyz",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.route).toBe("github-app-oauth-callback");
    expect(body.codeReceived).toBe(true);
    expect(body.state).toBe("xyz");
  });

  it("responds even with no query params, creating no session", async () => {
    const request = new Request("http://localhost:3000/api/github/oauth/callback");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.codeReceived).toBe(false);
    expect(body.signedIn).toBe(false);
    expect(body.reason).toBe("missing OAuth code");
    expect(countSessions()).toBe(0);
    expect(response.cookies.get("jumphour_session")).toBeUndefined();
  });

  it("denied/cancelled OAuth (error param) creates no session and stores no token, without calling GitHub", async () => {
    const request = new Request(
      "http://localhost:3000/api/github/oauth/callback?error=access_denied&state=xyz",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(body.signedIn).toBe(false);
    expect(body.reason).toContain("access_denied");
    expect(countSessions()).toBe(0);
    expect(response.cookies.get("jumphour_session")).toBeUndefined();
  });

  it("does not sign in and reports why when GitHub OAuth client credentials are not configured (never calls GitHub)", async () => {
    const request = new Request(
      "http://localhost:3000/api/github/oauth/callback?code=abc&state=xyz",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(body.signedIn).toBe(false);
    expect(body.reason).toBe("GitHub OAuth client credentials are not configured");
    expect(countSessions()).toBe(0);
  });
});
