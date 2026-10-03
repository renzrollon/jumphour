// Task 8.2: resolveWorkspace() reads every name through getInstallation() and
// reports a missing row as missing, never as an id or an invented name.
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../../../server/db/sqlite-driver";
import { runMigrations } from "../../../server/db/migrate";
import type { SqlDriver } from "../../../server/db/types";
import { upsertInstallation } from "../../../server/db/installations";
import { resolveWorkspace } from "./workspace";

const migrationsDir = path.join(import.meta.dirname, "..", "..", "..", "..", "migrations");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  upsertInstallation(driver, { githubInstallationId: 41, accountId: 900, accountLogin: "acme" });
  upsertInstallation(driver, { githubInstallationId: 42, accountId: 901, accountLogin: "globex" });
});

afterEach(() => {
  driver.close();
});

describe("resolveWorkspace", () => {
  it("names the bound installation by its stored account login", () => {
    expect(resolveWorkspace(driver, 41)).toEqual({
      current: { installationId: 41, accountLogin: "acme" },
      installations: [{ installationId: 41, accountLogin: "acme" }],
    });
  });

  it("reports no current installation when the session names none", () => {
    expect(resolveWorkspace(driver, null)).toEqual({ current: null, installations: [] });
  });

  it("reports no current installation when the named installation has no stored row", () => {
    expect(resolveWorkspace(driver, 7777)).toEqual({ current: null, installations: [] });
  });

  it("lists every stored known installation, in known order, and drops unstored ones", () => {
    const view = resolveWorkspace(driver, 42, [41, 42, 5555]);
    expect(view.current).toEqual({ installationId: 42, accountLogin: "globex" });
    expect(view.installations).toEqual([
      { installationId: 41, accountLogin: "acme" },
      { installationId: 42, accountLogin: "globex" },
    ]);
  });
});
