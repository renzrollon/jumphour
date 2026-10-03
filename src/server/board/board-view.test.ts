// Task 2.1 (design.md Decision 2): with no installation bound to the session,
// the provider returns `installation: null`, no repositories, and four empty
// lanes in board order — on a migrated in-memory database that does hold
// another installation's rows, so "empty" is not an accident of an empty store.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";
import { upsertInstallation } from "../db/installations";
import { upsertInstallationRepository } from "../db/installation-repositories";
import { buildBoardView, IDEA_INTAKE_UNAVAILABLE_REASON, PR_MR_FETCH_UNAVAILABLE_REASON } from "./board-view";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

const NOW = new Date("2026-09-24T12:00:00.000Z");

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  upsertInstallation(driver, { githubInstallationId: 11, accountId: 100, accountLogin: "octo-org" });
  upsertInstallationRepository(driver, { installationId: 11, githubRepoId: 501, fullName: "octo-org/api" });
});

afterEach(() => {
  driver.close();
});

describe("buildBoardView without an installation", () => {
  it("returns no installation, no repositories, and four empty lanes in board order", () => {
    const view = buildBoardView(driver, { installationId: null }, NOW);

    expect(view.installation).toBeNull();
    expect(view.repositories).toEqual([]);
    expect(view.lanes.map((lane) => lane.id)).toEqual(["idea", "openspec-change", "in-progress", "pr-mr"]);
    for (const lane of view.lanes) {
      expect(lane.cards).toEqual([]);
      expect(lane.listener).toEqual({ status: "not-configured" });
      expect(lane.manualRead).toBeNull();
    }
  });

  it("stamps generatedAt from the injected clock and offers no compose", () => {
    const view = buildBoardView(driver, { installationId: null }, NOW);

    expect(view.generatedAt).toBe("2026-09-24T12:00:00.000Z");
    expect(view.compose.status).toBe("unavailable");
  });

  it("is plain JSON", () => {
    const view = buildBoardView(driver, { installationId: null }, NOW);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

// Task 2.2 (design.md Decision 2; spec "Scope the board to the current
// installation"): with an installation bound, the account and repositories
// come from that installation's stored rows only.
describe("buildBoardView with an installation", () => {
  beforeEach(() => {
    upsertInstallation(driver, { githubInstallationId: 22, accountId: 200, accountLogin: "acme" });
    upsertInstallationRepository(driver, { installationId: 22, githubRepoId: 702, fullName: "acme/web" });
    upsertInstallationRepository(driver, { installationId: 22, githubRepoId: 701, fullName: "acme/api-gateway" });
  });

  it("returns the installation account and only its repositories", () => {
    const view = buildBoardView(driver, { installationId: 22 }, NOW);

    expect(view.installation).toEqual({ installationId: 22, accountLogin: "acme" });
    expect(view.repositories).toEqual([
      { githubRepoId: 701, fullName: "acme/api-gateway" },
      { githubRepoId: 702, fullName: "acme/web" },
    ]);
    expect(view.repositories.map((repo) => repo.fullName)).not.toContain("octo-org/api");
  });

  it("returns four empty, not-configured lanes in board order", () => {
    const view = buildBoardView(driver, { installationId: 22 }, NOW);

    expect(view.lanes.map((lane) => lane.id)).toEqual(["idea", "openspec-change", "in-progress", "pr-mr"]);
    for (const lane of view.lanes) {
      expect(lane.cards).toEqual([]);
      expect(lane.listener).toEqual({ status: "not-configured" });
    }
  });

  it("stamps generatedAt from the injected clock", () => {
    const view = buildBoardView(driver, { installationId: 22 }, NOW);
    expect(view.generatedAt).toBe(NOW.toISOString());
  });

  it("treats a session naming an unstored installation like no installation", () => {
    const view = buildBoardView(driver, { installationId: 999 }, NOW);

    expect(view.installation).toBeNull();
    expect(view.repositories).toEqual([]);
    expect(view.lanes).toHaveLength(4);
  });

  it("is plain JSON", () => {
    const view = buildBoardView(driver, { installationId: 22 }, NOW);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

// Task 2.3 (design.md Decision 2; spec "Offer manual reads only on the Idea
// and PR/MR lanes"): manual reads sit on the edge lanes only, unavailable with
// the brief's fixed reasons, and compose is unavailable too.
describe("buildBoardView manual reads", () => {
  it("attaches an unavailable load-ideas read to the idea lane", () => {
    const [idea] = buildBoardView(driver, { installationId: 11 }, NOW).lanes;

    expect(idea.manualRead).toEqual({
      kind: "load-ideas",
      availability: { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." },
      options: [],
    });
  });

  it("attaches an unavailable fetch-pull-requests read to the pr-mr lane", () => {
    const prMr = buildBoardView(driver, { installationId: 11 }, NOW).lanes[3];

    expect(prMr.id).toBe("pr-mr");
    expect(prMr.manualRead).toEqual({
      kind: "fetch-pull-requests",
      availability: { status: "unavailable", reason: "PR and MR fetching is not enabled for this installation yet." },
      options: [],
    });
  });

  it("leaves the two middle lanes without a manual read", () => {
    const [, change, progress] = buildBoardView(driver, { installationId: 11 }, NOW).lanes;

    expect(change.id).toBe("openspec-change");
    expect(change.manualRead).toBeNull();
    expect(progress.id).toBe("in-progress");
    expect(progress.manualRead).toBeNull();
  });

  it("sets compose unavailable with the intake reason", () => {
    const view = buildBoardView(driver, { installationId: 11 }, NOW);

    expect(view.compose).toEqual({ status: "unavailable", reason: IDEA_INTAKE_UNAVAILABLE_REASON });
    expect(PR_MR_FETCH_UNAVAILABLE_REASON).toBe("PR and MR fetching is not enabled for this installation yet.");
  });
});

// Task 2.4 (spec "Scope the board to the current installation"): with
// installations A and B both stored, a session on A yields A's account and
// repositories only — nothing of B's appears anywhere in the view model — and
// the same holds the other way round when the session's installation is B.
describe("buildBoardView tenancy", () => {
  const A = { githubInstallationId: 31, accountId: 310, accountLogin: "acme" };
  const B = { githubInstallationId: 32, accountId: 320, accountLogin: "beta" };

  beforeEach(() => {
    upsertInstallation(driver, A);
    upsertInstallation(driver, B);
    upsertInstallationRepository(driver, { installationId: A.githubInstallationId, githubRepoId: 3101, fullName: "acme/api-gateway" });
    upsertInstallationRepository(driver, { installationId: B.githubInstallationId, githubRepoId: 3201, fullName: "beta/web" });
    upsertInstallationRepository(driver, { installationId: B.githubInstallationId, githubRepoId: 3202, fullName: "beta/shared-api" });
  });

  it("a session on A yields only A's repositories and nothing of B's", () => {
    const view = buildBoardView(driver, { installationId: A.githubInstallationId }, NOW);

    expect(view.installation).toEqual({ installationId: A.githubInstallationId, accountLogin: "acme" });
    expect(view.repositories).toEqual([{ githubRepoId: 3101, fullName: "acme/api-gateway" }]);

    const serialized = JSON.stringify(view);
    for (const leak of ["beta", "beta/web", "beta/shared-api", "3201", "3202"]) {
      expect(serialized).not.toContain(leak);
    }
    for (const lane of view.lanes) expect(lane.cards).toEqual([]);
  });

  it("a session on B yields only B's repositories and nothing of A's", () => {
    const view = buildBoardView(driver, { installationId: B.githubInstallationId }, NOW);

    expect(view.installation).toEqual({ installationId: B.githubInstallationId, accountLogin: "beta" });
    expect(view.repositories.map((repo) => repo.fullName).sort()).toEqual(["beta/shared-api", "beta/web"]);

    const serialized = JSON.stringify(view);
    for (const leak of ["acme", "acme/api-gateway", "3101"]) {
      expect(serialized).not.toContain(leak);
    }
  });
});
