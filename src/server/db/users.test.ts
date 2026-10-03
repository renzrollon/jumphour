// Write path for task 3.4's OAuth sign-in: a signed-in GitHub user's row
// must be created once and updated (not duplicated) on a later sign-in —
// same shape as installations.test.ts / installation-repositories.test.ts.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";
import { runMigrations } from "./migrate";
import type { SqlDriver } from "./types";
import { getUser, upsertUser } from "./users";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
});

afterEach(() => {
  driver.close();
});

function countUsers(): number {
  return driver.get<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n;
}

describe("upsertUser", () => {
  it("inserts a new user once", () => {
    upsertUser(driver, { githubUserId: 7, login: "octocat" });

    expect(countUsers()).toBe(1);
    const row = driver.get<{ login: string }>("SELECT login FROM users WHERE github_user_id = ?", [7]);
    expect(row?.login).toBe("octocat");
  });

  it("signing in again for the same github_user_id updates the row instead of duplicating it", () => {
    upsertUser(driver, { githubUserId: 7, login: "octocat" });
    upsertUser(driver, { githubUserId: 7, login: "octocat-renamed" });

    expect(countUsers()).toBe(1);
    const row = driver.get<{ login: string }>("SELECT login FROM users WHERE github_user_id = ?", [7]);
    expect(row?.login).toBe("octocat-renamed");
  });
});

describe("getUser", () => {
  it("returns the id and login of a stored user", () => {
    upsertUser(driver, { githubUserId: 7, login: "octocat" });

    expect(getUser(driver, 7)).toEqual({ githubUserId: 7, login: "octocat" });
  });

  it("returns undefined for a user id that is not stored", () => {
    upsertUser(driver, { githubUserId: 7, login: "octocat" });

    expect(getUser(driver, 8)).toBeUndefined();
  });
});
