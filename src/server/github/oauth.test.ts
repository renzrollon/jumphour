// Task 3.4 building blocks: the code->token exchange and the identity read
// it enables. The identity read is a REST call and must carry CLAUDE.md's
// required headers, verified here the same way as app-client.test.ts (task
// 3.1) — a fake request function that records what was actually sent.
import { describe, expect, it, vi } from "vitest";
import {
  exchangeOAuthCode,
  fetchGithubUser,
  fetchUserInstallationRepositories,
  fetchUserInstallations,
} from "./oauth";
import { GITHUB_ACCEPT_HEADER, GITHUB_API_VERSION, type GithubRequestFn } from "./request";

describe("exchangeOAuthCode", () => {
  it("posts client credentials and code, returning the access token on success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ access_token: "gho_fake", token_type: "bearer", scope: "" }),
    });

    const result = await exchangeOAuthCode({
      clientId: "Iv1.abc",
      clientSecret: "shhh",
      code: "the-code",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ accessToken: "gho_fake" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ client_id: "Iv1.abc", client_secret: "shhh", code: "the-code" });
  });

  it("throws (never returns a token) when GitHub reports denial/failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({ error: "bad_verification_code", error_description: "code expired" }),
    });

    await expect(
      exchangeOAuthCode({
        clientId: "Iv1.abc",
        clientSecret: "shhh",
        code: "stale",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/code expired/);
  });
});

describe("fetchGithubUser", () => {
  it("sends X-GitHub-Api-Version and Accept on the outgoing GET /user call", async () => {
    const calls: Array<{ route: string; params?: Record<string, unknown> }> = [];
    const request: GithubRequestFn = async (route, params) => {
      calls.push({ route, params });
      return { data: { id: 7, login: "octocat" } };
    };

    const identity = await fetchGithubUser({ accessToken: "gho_fake", request });

    expect(identity).toEqual({ githubUserId: 7, login: "octocat" });
    expect(calls[0]?.route).toBe("GET /user");
    const headers = calls[0]?.params?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer gho_fake");
    expect(headers["x-github-api-version"]).toBe(GITHUB_API_VERSION);
    expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
  });
});

describe("fetchUserInstallations", () => {
  it("sends X-GitHub-Api-Version and Accept on the outgoing GET /user/installations call", async () => {
    const calls: Array<{ route: string; params?: Record<string, unknown> }> = [];
    const request: GithubRequestFn = async (route, params) => {
      calls.push({ route, params });
      return {
        data: {
          total_count: 1,
          installations: [
            { id: 42, account: { id: 100, login: "acme" }, permissions: { metadata: "read" } },
          ],
        },
      };
    };

    const installations = await fetchUserInstallations({ accessToken: "gho_fake", request });

    expect(installations).toEqual([
      { githubInstallationId: 42, accountId: 100, accountLogin: "acme", permissions: { metadata: "read" } },
    ]);
    expect(calls[0]?.route).toBe("GET /user/installations");
    const headers = calls[0]?.params?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer gho_fake");
    expect(headers["x-github-api-version"]).toBe(GITHUB_API_VERSION);
    expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
  });

  it("returns an empty list when the user has no overlapping installations", async () => {
    const request: GithubRequestFn = async () => ({ data: { total_count: 0, installations: [] } });

    const installations = await fetchUserInstallations({ accessToken: "gho_fake", request });

    expect(installations).toEqual([]);
  });

  it("skips an installation entry with no account rather than failing the whole list", async () => {
    const request: GithubRequestFn = async () => ({
      data: {
        total_count: 2,
        installations: [
          { id: 1, account: null, permissions: {} },
          { id: 2, account: { id: 200, login: "octo" }, permissions: null },
        ],
      },
    });

    const installations = await fetchUserInstallations({ accessToken: "gho_fake", request });

    expect(installations).toEqual([
      { githubInstallationId: 2, accountId: 200, accountLogin: "octo", permissions: null },
    ]);
  });
});

describe("fetchUserInstallationRepositories", () => {
  it("sends X-GitHub-Api-Version, Accept, and the bearer user token on the outgoing GET /user/installations/{id}/repositories call", async () => {
    const calls: Array<{ route: string; params?: Record<string, unknown> }> = [];
    const request: GithubRequestFn = async (route, params) => {
      calls.push({ route, params });
      return {
        data: {
          total_count: 1,
          repositories: [{ id: 1, full_name: "acme/api-gateway" }],
        },
      };
    };

    const repositories = await fetchUserInstallationRepositories({
      accessToken: "gho_fake",
      installationId: 42,
      request,
    });

    expect(repositories).toEqual([{ githubRepoId: 1, fullName: "acme/api-gateway" }]);
    expect(calls[0]?.route).toBe("GET /user/installations/{installation_id}/repositories");
    expect(calls[0]?.params?.installation_id).toBe(42);
    const headers = calls[0]?.params?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer gho_fake");
    expect(headers["x-github-api-version"]).toBe(GITHUB_API_VERSION);
    expect(headers.accept).toBe(GITHUB_ACCEPT_HEADER);
  });

  it("fixture: an installation with two repositories where the user can access one lists only the overlapping repo", async () => {
    // specs/github-app-installation/spec.md "Happy path — intersection of
    // installation and user access": an installation that includes
    // acme/api-gateway and acme/customer-web, and a signed-in user who can
    // access only acme/api-gateway. GitHub's own response to the
    // user-to-server call already reflects that access boundary — the
    // installation's other repository never appears — so the function must
    // not widen the result back out to the installation's full two repos.
    const request: GithubRequestFn = async () => ({
      data: {
        total_count: 1,
        repositories: [{ id: 1, full_name: "acme/api-gateway" }],
      },
    });

    const repositories = await fetchUserInstallationRepositories({
      accessToken: "gho_fake",
      installationId: 42,
      request,
    });

    expect(repositories).toEqual([{ githubRepoId: 1, fullName: "acme/api-gateway" }]);
    expect(repositories.some((repository) => repository.fullName === "acme/customer-web")).toBe(false);
  });

  it("returns an empty list when the user can access none of the installation's repositories", async () => {
    const request: GithubRequestFn = async () => ({ data: { total_count: 0, repositories: [] } });

    const repositories = await fetchUserInstallationRepositories({
      accessToken: "gho_fake",
      installationId: 42,
      request,
    });

    expect(repositories).toEqual([]);
  });
});
