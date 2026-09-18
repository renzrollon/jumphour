import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDriver, resetDriverForTests } from "../../../../server/db";
import { runMigrations } from "../../../../server/db/migrate";
import { GET } from "./route";

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
};
let tmpDir: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), "jumphour-setup-route-"));
  process.env.DATABASE_PATH = path.join(tmpDir, "jumphour.sqlite3");
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
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

function countInstallations(): number {
  return getDriver().get<{ n: number }>("SELECT COUNT(*) AS n FROM installations")!.n;
}

describe("GET /api/github/setup", () => {
  it("responds without requiring Marketplace listing, echoing installation_id/setup_action", async () => {
    const request = new Request(
      "http://localhost:3000/api/github/setup?installation_id=123&setup_action=install",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.route).toBe("github-app-setup-url");
    expect(body.installationId).toBe("123");
    expect(body.setupAction).toBe("install");
  });

  it("responds even with no query params, recording nothing", async () => {
    const request = new Request("http://localhost:3000/api/github/setup");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.installationId).toBeNull();
    expect(body.recorded).toBe(false);
    expect(body.reason).toBe("missing installation_id");
    expect(countInstallations()).toBe(0);
  });

  it("does not persist and reports why when GitHub App credentials are not configured (never calls GitHub)", async () => {
    const request = new Request(
      "http://localhost:3000/api/github/setup?installation_id=123&setup_action=install",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(body.recorded).toBe(false);
    expect(body.reason).toBe("GitHub App credentials are not configured");
    expect(countInstallations()).toBe(0);
  });
});
