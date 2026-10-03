// Task 5.1: specs/github-app-installation/spec.md "Fail closed when required
// GitHub permissions are missing" — happy path (all three permissions
// present) and the missing-permission failure, named by exactly which
// permission is short. `fetchInstallationPermissionStatus`'s network call is
// exercised with the same injected `GithubRequestFn` seam app-client.test.ts
// uses, so these tests never reach GitHub.
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkInstallationPermissions,
  fetchInstallationPermissionStatus,
  recheckInstallationPermissions,
  REQUIRED_INSTALLATION_PERMISSIONS,
} from "./installation-permissions";
import type { GithubRequestFn } from "./request";
import { createSqliteDriver } from "../db/sqlite-driver";
import { runMigrations } from "../db/migrate";
import type { SqlDriver } from "../db/types";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const fakeClock = { now: () => new Date("2026-09-18T12:00:00.000Z") };

function fakeRequest(response: { data: unknown }): GithubRequestFn {
  return async () => response;
}

describe("REQUIRED_INSTALLATION_PERMISSIONS", () => {
  it("is exactly metadata: read, contents: write, pull_requests: write", () => {
    expect(REQUIRED_INSTALLATION_PERMISSIONS).toEqual([
      { name: "metadata", access: "read" },
      { name: "contents", access: "write" },
      { name: "pull_requests", access: "write" },
    ]);
  });
});

describe("checkInstallationPermissions", () => {
  it("Scenario: happy path — required permissions are present", () => {
    const result = checkInstallationPermissions({
      metadata: "read",
      contents: "write",
      pull_requests: "write",
    });

    expect(result).toEqual({ sufficient: true });
  });

  it("is sufficient when a granted level exceeds what is required (write satisfies a read requirement)", () => {
    const result = checkInstallationPermissions({
      metadata: "write",
      contents: "write",
      pull_requests: "write",
    });

    expect(result).toEqual({ sufficient: true });
  });

  it("Scenario: failure — a missing contents write reports that permission by name", () => {
    const result = checkInstallationPermissions({
      metadata: "read",
      pull_requests: "write",
    });

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "contents",
      reason: 'installation does not grant required permission "contents: write"',
    });
  });

  it("reports contents by name when it is granted only at read, not write", () => {
    const result = checkInstallationPermissions({
      metadata: "read",
      contents: "read",
      pull_requests: "write",
    });

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "contents",
      reason: 'installation grants "contents: read" but "contents: write" is required',
    });
  });

  it("reports pull_requests by name when it is the only one missing", () => {
    const result = checkInstallationPermissions({
      metadata: "read",
      contents: "write",
    });

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "pull_requests",
      reason: 'installation does not grant required permission "pull_requests: write"',
    });
  });

  it("reports the first missing permission (metadata) when GitHub sent no permissions at all", () => {
    const result = checkInstallationPermissions(null);

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "metadata",
      reason: 'installation does not grant required permission "metadata: read"',
    });
  });
});

describe("fetchInstallationPermissionStatus", () => {
  it("reads GET /app/installations/{id} and reports sufficient when all three are granted", async () => {
    const result = await fetchInstallationPermissionStatus({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      request: fakeRequest({
        data: {
          account: { id: 100, login: "acme" },
          permissions: { metadata: "read", contents: "write", pull_requests: "write" },
        },
      }),
    });

    expect(result).toEqual({ sufficient: true });
  });

  it("reads GET /app/installations/{id} and names contents when the installation lacks contents write", async () => {
    const result = await fetchInstallationPermissionStatus({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      request: fakeRequest({
        data: {
          account: { id: 100, login: "acme" },
          permissions: { metadata: "read", pull_requests: "write" },
        },
      }),
    });

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "contents",
      reason: 'installation does not grant required permission "contents: write"',
    });
  });
});

describe("recheckInstallationPermissions", () => {
  let driver: SqlDriver;

  beforeEach(() => {
    driver = createSqliteDriver(":memory:");
    runMigrations(driver, migrationsDir);
  });

  afterEach(() => {
    driver.close();
  });

  it("overwrites a stored sufficient snapshot with the current gap after a permission is revoked", async () => {
    const now = new Date().toISOString();
    driver.run(
      `INSERT INTO installations
         (github_installation_id, account_id, account_login, permission_snapshot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        42,
        100,
        "acme",
        JSON.stringify({ metadata: "read", contents: "write", pull_requests: "write" }),
        now,
        now,
      ],
    );

    const result = await recheckInstallationPermissions({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      driver,
      request: fakeRequest({
        data: {
          account: { id: 100, login: "acme" },
          // contents: write was revoked since the stored snapshot.
          permissions: { metadata: "read", pull_requests: "write" },
        },
      }),
    });

    expect(result).toEqual({
      sufficient: false,
      missingPermission: "contents",
      reason: 'installation does not grant required permission "contents: write"',
    });

    const row = driver.get<{ permission_snapshot: string }>(
      "SELECT permission_snapshot FROM installations WHERE github_installation_id = ?",
      [42],
    );
    expect(JSON.parse(row!.permission_snapshot)).toEqual({
      metadata: "read",
      pull_requests: "write",
    });
  });
});
