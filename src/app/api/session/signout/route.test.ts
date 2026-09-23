// Task 6.4: local-only, idempotent sign-out (design.md Decision 7).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDriver, resetDriverForTests } from "../../../../server/db";
import { runMigrations } from "../../../../server/db/migrate";
import { getSession } from "../../../../server/db/sessions";
import * as routeModule from "./route";
import { POST } from "./route";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "migrations");

const savedDatabasePath = process.env.DATABASE_PATH;
let tmpDir: string | undefined;
let fetchCalls: unknown[][];

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-signout-route-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "jumphour.sqlite3");
  resetDriverForTests();
  runMigrations(getDriver(), migrationsDir);
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (...args: unknown[]) => {
      fetchCalls.push(args);
      return new Response("unexpected", { status: 599 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetDriverForTests();
  if (savedDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = savedDatabasePath;
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

function seedSession(id: string, githubUserId = 42): void {
  const driver = getDriver();
  driver.run("INSERT INTO users (github_user_id, login) VALUES (?, ?)", [githubUserId, `user${githubUserId}`]);
  driver.run("INSERT INTO sessions (id, github_user_id, installation_id) VALUES (?, ?, NULL)", [id, githubUserId]);
}

function signOut(cookie?: string): Promise<Response> {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", cookie);
  return POST(new Request("http://localhost:3000/api/session/signout", { method: "POST", headers }));
}

function expectSignedOutLanding(response: Response) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:3000/");
  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toMatch(/^jumphour_session=;/);
  expect(setCookie).toMatch(/Max-Age=0/i);
  expect(setCookie).toMatch(/Path=\//);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).not.toContain("jumphour_theme");
  expect(setCookie).not.toContain("jumphour_cats");
}

describe("POST /api/session/signout", () => {
  it("deletes the session row, clears the cookie, and 303s to /", async () => {
    seedSession("live-session");

    const response = await signOut("jumphour_session=live-session");

    expectSignedOutLanding(response);
    expect(getSession(getDriver(), "live-session")).toBeUndefined();
    expect(fetchCalls).toEqual([]);
  });

  it("leaves other sessions and the user row intact", async () => {
    seedSession("mine", 42);
    seedSession("theirs", 7);

    await signOut("jumphour_session=mine");

    expect(getSession(getDriver(), "theirs")).toBeDefined();
    expect(getDriver().get<{ n: number }>("SELECT COUNT(*) AS n FROM users")!.n).toBe(2);
  });

  it("is idempotent with no session cookie: same landing, cookie still cleared", async () => {
    seedSession("untouched");

    const response = await signOut();

    expectSignedOutLanding(response);
    expect(getSession(getDriver(), "untouched")).toBeDefined();
    expect(fetchCalls).toEqual([]);
  });

  it("is idempotent for an unknown session id: same landing, no error surface", async () => {
    const response = await signOut("jumphour_session=no-such-session");

    expectSignedOutLanding(response);
    expect(await response.text()).not.toMatch(/error|not signed in/i);
    expect(fetchCalls).toEqual([]);
  });

  it("signing out twice gives the same response both times", async () => {
    seedSession("twice");

    const first = await signOut("jumphour_session=twice");
    const second = await signOut("jumphour_session=twice");

    expectSignedOutLanding(first);
    expectSignedOutLanding(second);
    expect(second.headers.get("set-cookie")).toBe(first.headers.get("set-cookie"));
  });

  it("leaves the appearance cookies alone", async () => {
    seedSession("s");

    const response = await signOut("jumphour_theme=dark; jumphour_session=s; jumphour_cats=on");

    expectSignedOutLanding(response);
    expect(response.headers.getSetCookie()).toHaveLength(1);
  });

  it("makes no GitHub request in any case", async () => {
    seedSession("s");
    await signOut("jumphour_session=s");
    await signOut("jumphour_session=s");
    await signOut();
    expect(fetchCalls).toEqual([]);
  });

  it("exports only POST, so a GET cannot end a session", () => {
    expect(Object.keys(routeModule).filter((k) => /^(GET|HEAD|PUT|PATCH|DELETE)$/.test(k))).toEqual([]);
  });
});
