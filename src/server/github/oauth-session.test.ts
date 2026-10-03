// Task 3.4: verify denied/cancelled OAuth creates no session and stores no
// token; verify the happy path creates a session bound to github_user_id.
// specs/github-app-installation/spec.md "Failure — GitHub sign-in is denied
// or cancelled": no session created, no credentials from the failed
// attempt persisted.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { completeOAuthSignIn } from "./oauth-session";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
});

afterEach(() => {
  driver.close();
});

function countSessions(): number {
  return driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM sessions")!.n;
}

function countUsers(): number {
  return driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n;
}

describe("completeOAuthSignIn", () => {
  it("denied OAuth (error param present) creates no session and stores no token, without calling GitHub", async () => {
    const exchangeCode = vi.fn();
    const fetchGithubUser = vi.fn();

    const outcome = await completeOAuthSignIn({
      code: null,
      error: "access_denied",
      driver,
      exchangeCode,
      fetchGithubUser,
    });

    expect(outcome.signedIn).toBe(false);
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(fetchGithubUser).not.toHaveBeenCalled();
    expect(countSessions()).toBe(0);
    expect(countUsers()).toBe(0);
  });

  it("a cancelled flow (no code, no error) creates no session and stores no token, without calling GitHub", async () => {
    const exchangeCode = vi.fn();
    const fetchGithubUser = vi.fn();

    const outcome = await completeOAuthSignIn({
      code: null,
      error: null,
      driver,
      exchangeCode,
      fetchGithubUser,
    });

    expect(outcome.signedIn).toBe(false);
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(fetchGithubUser).not.toHaveBeenCalled();
    expect(countSessions()).toBe(0);
    expect(countUsers()).toBe(0);
  });

  it("a valid callback creates a session bound to github_user_id", async () => {
    const exchangeCode = vi.fn().mockResolvedValue({ accessToken: "gho_fake" });
    const fetchGithubUser = vi.fn().mockResolvedValue({ githubUserId: 7, login: "octocat" });

    const outcome = await completeOAuthSignIn({
      code: "the-code",
      error: null,
      driver,
      exchangeCode,
      fetchGithubUser,
      generateSessionId: () => "session-1",
    });

    expect(outcome).toEqual({ signedIn: true, sessionId: "session-1", githubUserId: 7 });
    expect(exchangeCode).toHaveBeenCalledWith("the-code");
    expect(fetchGithubUser).toHaveBeenCalledWith("gho_fake");

    expect(countSessions()).toBe(1);
    const session = driver.get<{ github_user_id: number; installation_id: number | null }>(
      "SELECT github_user_id, installation_id FROM sessions WHERE id = ?",
      ["session-1"],
    );
    expect(session?.github_user_id).toBe(7);
    expect(session?.installation_id).toBeNull();

    const user = driver.get<{ login: string }>("SELECT login FROM users WHERE github_user_id = ?", [7]);
    expect(user?.login).toBe("octocat");
  });

  it("stores no raw access token anywhere: the sessions row has no token-shaped column", async () => {
    const exchangeCode = vi.fn().mockResolvedValue({ accessToken: "gho_super_secret" });
    const fetchGithubUser = vi.fn().mockResolvedValue({ githubUserId: 7, login: "octocat" });

    await completeOAuthSignIn({
      code: "the-code",
      error: null,
      driver,
      exchangeCode,
      fetchGithubUser,
      generateSessionId: () => "session-1",
    });

    const session = driver.get<Record<string, unknown>>("SELECT * FROM sessions WHERE id = ?", ["session-1"]);
    expect(Object.values(session ?? {})).not.toContain("gho_super_secret");
  });
});
