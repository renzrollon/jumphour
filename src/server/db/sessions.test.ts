// Task 7.2: the `sessions.installation_id` read/write path the installation
// switcher (../github/switch-current-installation.ts) is built on. See
// openspec/changes/github-app-and-openspec-discovery/specs/
// github-app-installation/spec.md "Edge case — same GitHub user in two
// installations".
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";
import { deleteSession, getSession, setSessionInstallation } from "./sessions";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  const now = new Date().toISOString();
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [1, 100, "acme", now, now],
  );
  driver.run(
    `INSERT INTO installations (github_installation_id, account_id, account_login, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [2, 200, "other-org", now, now],
  );
  driver.run(`INSERT INTO users (github_user_id, login) VALUES (?, ?)`, [7, "octocat"]);
});

afterEach(() => {
  driver.close();
});

describe("getSession", () => {
  it("returns undefined for a session id that does not exist", () => {
    expect(getSession(driver, "missing")).toBeUndefined();
  });

  it("returns the stored row, including a null installation_id", () => {
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, NULL)`, [
      "session-1",
      7,
    ]);

    expect(getSession(driver, "session-1")).toEqual({ sessionId: "session-1", githubUserId: 7, installationId: null });
  });
});

describe("setSessionInstallation", () => {
  it("updates installation_id on an existing session and returns true", () => {
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, [
      "session-1",
      7,
      1,
    ]);

    const updated = setSessionInstallation(driver, "session-1", 2);

    expect(updated).toBe(true);
    expect(getSession(driver, "session-1")?.installationId).toBe(2);
  });

  it("returns false and writes nothing for a session id that does not exist", () => {
    const updated = setSessionInstallation(driver, "missing", 2);

    expect(updated).toBe(false);
    expect(getSession(driver, "missing")).toBeUndefined();
  });
});

describe("deleteSession", () => {
  it("deletes a live session, returns true, and the session is no longer readable", () => {
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, ["session-1", 7, 1]);

    expect(deleteSession(driver, "session-1")).toBe(true);
    expect(getSession(driver, "session-1")).toBeUndefined();
  });

  it("returns false without throwing for an unknown session id", () => {
    expect(() => deleteSession(driver, "missing")).not.toThrow();
    expect(deleteSession(driver, "missing")).toBe(false);
  });

  it("leaves every other session row untouched", () => {
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, ["session-1", 7, 1]);
    driver.run(`INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, ?)`, ["session-2", 7, 2]);

    expect(deleteSession(driver, "session-1")).toBe(true);
    expect(getSession(driver, "session-2")).toEqual({ sessionId: "session-2", githubUserId: 7, installationId: 2 });
    expect(driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM sessions")!.n).toBe(1);
  });
});
