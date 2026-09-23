import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDriver, resetDriverForTests } from "../../../../../server/db";
import { runMigrations } from "../../../../../server/db/migrate";
import { exchangeOAuthCode, fetchGithubUser, fetchUserInstallations } from "../../../../../server/github/oauth";
import { completeRefreshCallback } from "../../../../../server/github/complete-refresh-callback";
import { encodeRefreshState } from "../../../../../server/github/refresh-return-state";
import { GET } from "./route";

// Design.md Decision 6 / task 7.3: this suite used to assert on the JSON body
// (ok, codeReceived, state, signedIn, reason). Each of those assertions was
// rewritten one-for-one against the redirect rather than deleted:
//   - "responds without requiring Marketplace listing, echoing code/state"
//       -> a callback with code + state is answered with a 303 (never a 500),
//          and a non-refresh state is treated as a plain sign-in
//   - "responds even with no query params, creating no session"
//       -> 303 to /?signin=failed, no cookie, no row
//   - "denied/cancelled OAuth ... without calling GitHub"
//       -> 303 to /?signin=failed, no cookie, no row, no GitHub call
//   - "does not sign in and reports why when credentials are not configured
//      (never calls GitHub)"
//       -> 303 to /?signin=failed, no GitHub call; the "why" deliberately no
//          longer leaves the server, so the test asserts it is absent
// plus the facts Decision 6 names: a thrown exchange does not 500, and a
// refresh round trip still re-lists and returns to the surface.

vi.mock("../../../../../server/github/oauth", () => ({
  exchangeOAuthCode: vi.fn(async () => ({ accessToken: "gho_secret_token" })),
  fetchGithubUser: vi.fn(async () => ({ githubUserId: 42, login: "octocat" })),
  fetchUserInstallations: vi.fn(async () => []),
}));

vi.mock("../../../../../server/github/complete-refresh-callback", () => ({
  completeRefreshCallback: vi.fn(async () => ({ refreshed: true, installationId: 99, repositoryCount: 0 })),
}));

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
  vi.clearAllMocks();
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
  async function expectFailedSignIn(response: Response, forbidden: string[]) {
    expect(response.status).toBe(303);
    const location = response.headers.get("location");
    expect(location).toBe("http://localhost:3000/?signin=failed");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("jumphour_session");
    expect(countSessions()).toBe(0);
    const body = await response.text();
    const headers = JSON.stringify([...response.headers.entries()]);
    for (const secret of forbidden) {
      expect(body).not.toContain(secret);
      expect(headers).not.toContain(secret);
      expect(location).not.toContain(secret);
    }
  }

  it("a sign-in with no query params 303s to /?signin=failed, creating no session", async () => {
    const response = await GET(new Request("http://localhost:3000/api/github/oauth/callback"));
    await expectFailedSignIn(response, ["missing OAuth code"]);
  });

  it("denied/cancelled OAuth (error param) 303s to /?signin=failed without a session or the reason", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/github/oauth/callback?error=access_denied&state=xyz"),
    );
    await expectFailedSignIn(response, ["access_denied"]);
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
    expect(fetchGithubUser).not.toHaveBeenCalled();
  });

  it("unconfigured client credentials 303s to /?signin=failed, leaking neither code nor reason", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/github/oauth/callback?code=abc-secret-code&state=xyz"),
    );
    await expectFailedSignIn(response, ["abc-secret-code", "not configured", "credentials"]);
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
    expect(fetchGithubUser).not.toHaveBeenCalled();
  });

  it("a thrown token exchange does not 500 and leaks no code, token, client id, or reason", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "client-id-leak";
    process.env.GITHUB_APP_CLIENT_SECRET = "client-secret-leak";
    vi.mocked(exchangeOAuthCode).mockRejectedValueOnce(
      new Error("exchange failed for client-id-leak with gho_secret_token"),
    );
    const response = await GET(
      new Request("http://localhost:3000/api/github/oauth/callback?code=abc-secret-code&state=xyz"),
    );
    await expectFailedSignIn(response, [
      "abc-secret-code",
      "gho_secret_token",
      "client-id-leak",
      "client-secret-leak",
      "exchange failed",
    ]);
    expect(response.status).not.toBe(500);
  });

  it("a successful plain sign-in 303s to / carrying the session cookie", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "client-id";
    process.env.GITHUB_APP_CLIENT_SECRET = "client-secret";
    const request = new Request(
      "http://localhost:3000/api/github/oauth/callback?code=abc&state=xyz",
    );

    const response = await GET(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    const sessionId = response.cookies.get("jumphour_session")?.value;
    expect(sessionId).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain(`jumphour_session=${sessionId}`);
    expect(countSessions()).toBe(1);
  });

  it("a code + ordinary state needs no Marketplace listing and is treated as a plain sign-in", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "client-id";
    process.env.GITHUB_APP_CLIENT_SECRET = "client-secret";

    const response = await GET(new Request("http://localhost:3000/api/github/oauth/callback?code=abc&state=xyz"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(exchangeOAuthCode).toHaveBeenCalledWith(expect.objectContaining({ code: "abc" }));
    expect(completeRefreshCallback).not.toHaveBeenCalled();
  });

  it("a refresh round trip re-lists the named installation and returns to the surface with a session", async () => {
    process.env.GITHUB_APP_CLIENT_ID = "client-id";
    process.env.GITHUB_APP_CLIENT_SECRET = "client-secret";
    vi.mocked(fetchUserInstallations).mockResolvedValueOnce([]);
    const state = encodeRefreshState(99);

    const response = await GET(
      new Request(`http://localhost:3000/api/github/oauth/callback?code=abc&state=${encodeURIComponent(state)}`),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    const sessionId = response.cookies.get("jumphour_session")?.value;
    expect(sessionId).toBeTruthy();
    expect(countSessions()).toBe(1);
    expect(fetchUserInstallations).toHaveBeenCalledWith({ accessToken: "gho_secret_token" });
    expect(completeRefreshCallback).toHaveBeenCalledTimes(1);
    expect(completeRefreshCallback).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId, installationId: 99, accessibleInstallationIds: [] }),
    );
    expect(response.headers.get("location")).not.toContain("gho_secret_token");
  });
});
