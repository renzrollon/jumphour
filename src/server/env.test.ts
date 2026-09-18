import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnv } from "./env";

const KEYS = [
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "DATABASE_PATH",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("getEnv", () => {
  it("reads GitHub App secrets from the environment, not from literals", () => {
    process.env.GITHUB_APP_ID = "12345";
    process.env.GITHUB_APP_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----";
    process.env.GITHUB_APP_CLIENT_ID = "Iv1.abc123";
    process.env.GITHUB_APP_CLIENT_SECRET = "shhh";

    const env = getEnv();

    expect(env.githubAppId).toBe("12345");
    expect(env.githubAppPrivateKey).toContain("BEGIN RSA PRIVATE KEY");
    expect(env.githubAppClientId).toBe("Iv1.abc123");
    expect(env.githubAppClientSecret).toBe("shhh");
  });

  it("returns undefined (not empty string or a guessed default) when unset", () => {
    const env = getEnv();

    expect(env.githubAppId).toBeUndefined();
    expect(env.githubAppPrivateKey).toBeUndefined();
    expect(env.githubAppClientId).toBeUndefined();
    expect(env.githubAppClientSecret).toBeUndefined();
    expect(env.databasePath).toBeUndefined();
  });

  it("treats an empty-string env var as unset", () => {
    process.env.GITHUB_APP_ID = "";

    expect(getEnv().githubAppId).toBeUndefined();
  });
});
