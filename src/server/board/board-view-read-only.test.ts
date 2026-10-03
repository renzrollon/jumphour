// Task 2.5 (design.md Decision 2; spec purpose "a read-only projection of
// evidence"): building the board neither writes a row nor calls GitHub.
//
// Two recorders, each proven able to fail before it is trusted:
//   - a recording SqlDriver that logs every statement the provider issues, so
//     the test asserts on the SQL actually sent rather than on the source;
//   - the existing GitHub method recorder (../github/github-method-recorder),
//     installed as the production request seam by mocking createOctokitRequest,
//     with global fetch stubbed as a second net, so any GitHub call reachable
//     from buildBoardView would be recorded.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { upsertInstallation } from "../db/installations";
import { upsertInstallationRepository } from "../db/installation-repositories";
import { recordGithubMethods } from "../github/github-method-recorder";
import { createOctokitRequest } from "../github/request";
import { buildBoardView } from "./board-view";

const github = vi.hoisted(() => ({ recorder: null as ReturnType<typeof recordGithubMethods> | null }));

vi.mock("../github/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../github/request")>();
  const { recordGithubMethods: record } = await import("../github/github-method-recorder");
  return {
    ...actual,
    createOctokitRequest: () => {
      github.recorder ??= record();
      return github.recorder.request;
    },
  };
});

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");
const NOW = new Date("2026-09-24T12:00:00.000Z");
const WRITE_STATEMENT = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE|UPSERT|MERGE)\b|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;

interface RecordedStatement {
  method: "exec" | "run" | "all" | "get" | "transaction";
  sql: string;
}

/** Wraps `inner`, logging every statement (and transaction) before it runs. */
function recordingDriver(inner: SqlDriver): SqlDriver & { statements: RecordedStatement[] } {
  const statements: RecordedStatement[] = [];
  return {
    statements,
    exec: (sql) => {
      statements.push({ method: "exec", sql });
      inner.exec(sql);
    },
    run: (sql, params) => {
      statements.push({ method: "run", sql });
      return inner.run(sql, params);
    },
    all: (sql, params) => {
      statements.push({ method: "all", sql });
      return inner.all(sql, params);
    },
    get: (sql, params) => {
      statements.push({ method: "get", sql });
      return inner.get(sql, params);
    },
    transaction: (fn) => {
      statements.push({ method: "transaction", sql: "" });
      return inner.transaction(fn);
    },
    close: () => inner.close(),
  };
}

const writesIn = (statements: RecordedStatement[]) =>
  statements.filter((s) => s.method === "exec" || s.method === "run" || s.method === "transaction" || WRITE_STATEMENT.test(s.sql));

let inner: SqlDriver;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  inner = createSqliteDriver(":memory:");
  runMigrations(inner, migrationsDir);
  upsertInstallation(inner, { githubInstallationId: 41, accountId: 410, accountLogin: "acme" });
  upsertInstallationRepository(inner, { installationId: 41, githubRepoId: 4101, fullName: "acme/api-gateway" });
  github.recorder = recordGithubMethods();
  fetchSpy = vi.fn(async () => {
    throw new Error("network access is not allowed while building the board");
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  inner.close();
});

describe("the recorders can fail", () => {
  it("the recording driver flags an INSERT, an UPDATE, and a DELETE", () => {
    const driver = recordingDriver(inner);
    upsertInstallation(driver, { githubInstallationId: 42, accountId: 420, accountLogin: "beta" });
    driver.run("UPDATE installations SET account_login = ? WHERE github_installation_id = ?", ["b", 42]);
    driver.run("DELETE FROM installations WHERE github_installation_id = ?", [42]);

    const writes = writesIn(driver.statements).map((s) => s.sql);
    expect(writes.some((sql) => /INSERT/i.test(sql))).toBe(true);
    expect(writes.some((sql) => /^\s*UPDATE/i.test(sql))).toBe(true);
    expect(writes.some((sql) => /^\s*DELETE/i.test(sql))).toBe(true);
  });

  it("the GitHub recorder sees a request made through the production seam", async () => {
    await expect(createOctokitRequest()("GET /user/installations")).rejects.toThrow();
    expect(github.recorder?.calls.map((call) => call.route)).toEqual(["GET /user/installations"]);
  });
});

describe.each([
  ["with an installation", { installationId: 41 }],
  ["with no installation", { installationId: null }],
  ["with an unstored installation", { installationId: 999 }],
])("buildBoardView %s", (_label, session) => {
  it("issues only reads through the driver", () => {
    const driver = recordingDriver(inner);
    buildBoardView(driver, session, NOW);

    expect(writesIn(driver.statements)).toEqual([]);
    for (const statement of driver.statements) expect(statement.sql).toMatch(/^\s*SELECT\b/i);
  });

  it("makes zero GitHub requests", () => {
    buildBoardView(recordingDriver(inner), session, NOW);

    expect(github.recorder?.calls).toEqual([]);
    expect(github.recorder?.writes()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

it("reads the stored rows when an installation is bound, so the driver recorder is live", () => {
  const driver = recordingDriver(inner);
  const view = buildBoardView(driver, { installationId: 41 }, NOW);

  expect(view.repositories).toEqual([{ githubRepoId: 4101, fullName: "acme/api-gateway" }]);
  expect(driver.statements.length).toBeGreaterThanOrEqual(2);
});
