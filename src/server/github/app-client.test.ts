// Task 3.1: GitHub App JWT + installation-token minting must send
// `X-GitHub-Api-Version: 2026-03-10` (CLAUDE.md "GitHub access") on every
// outgoing call. Verified here with a fake GitHub clock (so the minted
// JWT's `iat`/`exp` are asserted exactly, not just "some string") and a
// fake request function that records what was actually sent, so the test
// never reaches the network.
import { describe, expect, it } from "vitest";
import { fetchInstallationAccount, mintInstallationToken } from "./app-client";
import { GITHUB_ACCEPT_HEADER, GITHUB_API_VERSION, type GithubRequestFn } from "./request";

// A minimal but real 2048-bit RSA keypair, generated once for these tests.
// Real (not a placeholder string) because the JWT is actually RS256-signed
// and this suite checks the signature verifies.
import { generateKeyPairSync, verify as verifySignature } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const FAKE_NOW = new Date("2026-09-18T12:00:00.000Z");
const fakeClock = { now: () => FAKE_NOW };

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payloadSegment] = jwt.split(".");
  return JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
}

function verifyJwtSignature(jwt: string): boolean {
  const [headerSegment, payloadSegment, signatureSegment] = jwt.split(".");
  const signingInput = `${headerSegment}.${payloadSegment}`;
  return verifySignature(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    publicKey,
    Buffer.from(signatureSegment, "base64url"),
  );
}

interface RecordedCall {
  route: string;
  params: Record<string, unknown> | undefined;
}

function fakeRequest(response: { data: unknown }): { request: GithubRequestFn; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const request: GithubRequestFn = async (route, params) => {
    calls.push({ route, params });
    return response;
  };
  return { request, calls };
}

describe("mintInstallationToken", () => {
  it("sends X-GitHub-Api-Version and Accept on the outgoing access-token call", async () => {
    const { request, calls } = fakeRequest({
      data: { token: "ghs_fake", expires_at: "2026-09-18T13:00:00Z" },
    });

    const result = await mintInstallationToken({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      request,
    });

    expect(result).toEqual({ token: "ghs_fake", expiresAt: "2026-09-18T13:00:00Z" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.route).toBe("POST /app/installations/{installation_id}/access_tokens");
    expect(calls[0]?.params?.installation_id).toBe(42);

    const headers = calls[0]?.params?.headers as Record<string, string>;
    expect(headers["x-github-api-version"]).toBe(GITHUB_API_VERSION);
    expect(headers["x-github-api-version"]).toBe("2026-03-10");
    expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
  });

  it("authenticates with a JWT minted from the fake clock, correctly RS256-signed", async () => {
    const { request, calls } = fakeRequest({
      data: { token: "ghs_fake", expires_at: "2026-09-18T13:00:00Z" },
    });

    await mintInstallationToken({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      request,
    });

    const headers = calls[0]?.params?.headers as Record<string, string>;
    const [, jwt] = headers.authorization.split("Bearer ");
    expect(verifyJwtSignature(jwt)).toBe(true);

    const payload = decodeJwtPayload(jwt);
    const fakeNowSeconds = Math.floor(FAKE_NOW.getTime() / 1000);
    expect(payload.iss).toBe("12345");
    expect(payload.iat).toBe(fakeNowSeconds - 60);
    expect(payload.exp).toBe(fakeNowSeconds + 600);
  });
});

describe("fetchInstallationAccount", () => {
  it("sends X-GitHub-Api-Version and Accept on the outgoing installation-read call", async () => {
    const { request, calls } = fakeRequest({
      data: { account: { id: 100, login: "acme" }, permissions: { metadata: "read" } },
    });

    const result = await fetchInstallationAccount({
      appId: "12345",
      privateKey,
      installationId: 42,
      clock: fakeClock,
      request,
    });

    expect(result).toEqual({ accountId: 100, accountLogin: "acme", permissions: { metadata: "read" } });
    expect(calls[0]?.route).toBe("GET /app/installations/{installation_id}");

    const headers = calls[0]?.params?.headers as Record<string, string>;
    expect(headers["x-github-api-version"]).toBe("2026-03-10");
    expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
  });

  it("throws rather than inventing an account when GitHub reports none", async () => {
    const { request } = fakeRequest({ data: { account: null } });

    await expect(
      fetchInstallationAccount({ appId: "12345", privateKey, installationId: 42, clock: fakeClock, request }),
    ).rejects.toThrow(/no associated account/);
  });
});
