// Task 6.1: specs/openspec-discovery/spec.md "Happy path — config and change
// layout exist" — a repository whose default branch has parseable
// `openspec/config.yaml` and a directory `openspec/changes/` classifies as
// `supported`, reporting the config path and the YAML `schema` value when
// present. Same fake-`request`-function convention as oauth.test.ts /
// app-client.test.ts: a route-and-params-aware fake stands in for Octokit so
// no network call is made.
import { describe, expect, it } from "vitest";
import { classifyOpenSpecSupport } from "./classify-openspec-support";
import { GITHUB_ACCEPT_HEADER, GITHUB_API_VERSION, type GithubRequestFn } from "./request";

function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/** Builds an error shaped like Octokit's `RequestError` (and every other
 * fake `request` in this file): a thrown `Error` carrying `.status`, which
 * `classifyOpenSpecSupport`'s `statusOf` reads to tell "not found" (404)
 * apart from an access failure (401/403). */
function githubError(status: number, message = "GitHub request failed"): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

/** A fake GithubRequestFn that answers the four calls
 * classifyOpenSpecSupport issues for a fully "supported" repository:
 * repo metadata, the default branch ref, the config file, and the changes
 * directory listing — dispatched by route + the `path` param, since the
 * contents route is reused for both file and directory reads. */
function happyPathRequest(params: {
  defaultBranch: string;
  tipSha: string;
  configYaml: string;
  changesEntries: Array<{ name: string; type: string }>;
}): GithubRequestFn {
  return async (route, requestParams) => {
    if (route === "GET /repos/{owner}/{repo}") {
      return { data: { default_branch: params.defaultBranch } };
    }
    if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
      expect(requestParams?.ref).toBe(`heads/${params.defaultBranch}`);
      return { data: { object: { sha: params.tipSha } } };
    }
    if (route === "GET /repos/{owner}/{repo}/contents/{path}") {
      expect(requestParams?.ref).toBe(params.defaultBranch);
      if (requestParams?.path === "openspec/config.yaml") {
        return { data: { type: "file", encoding: "base64", content: base64(params.configYaml) } };
      }
      if (requestParams?.path === "openspec/changes") {
        return { data: params.changesEntries };
      }
    }
    throw new Error(`unexpected route in test fixture: ${route}`);
  };
}

describe("classifyOpenSpecSupport", () => {
  it("fixture: parseable config + a changes directory classifies as supported, with configPath and schema", async () => {
    const request = happyPathRequest({
      defaultBranch: "main",
      tipSha: "abc123",
      configYaml: "schema: spec-driven\n",
      changesEntries: [{ name: "add-feature", type: "dir" }],
    });

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report).toEqual({
      status: "supported",
      defaultBranch: "main",
      tipSha: "abc123",
      configPath: "openspec/config.yaml",
      schema: "spec-driven",
    });
  });

  it("omits schema (rather than inventing one) when the config has none — schema is optional", async () => {
    const request = happyPathRequest({
      defaultBranch: "main",
      tipSha: "def456",
      configYaml: "# no schema field here\n",
      changesEntries: [],
    });

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report).toEqual({
      status: "supported",
      defaultBranch: "main",
      tipSha: "def456",
      configPath: "openspec/config.yaml",
    });
    expect(report.schema).toBeUndefined();
  });

  it("sends X-GitHub-Api-Version, Accept, and the bearer installation token on every outgoing call", async () => {
    const calls: Array<{ route: string; headers?: Record<string, string> }> = [];
    const request: GithubRequestFn = async (route, requestParams) => {
      calls.push({ route, headers: requestParams?.headers as Record<string, string> | undefined });
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "abc123" } } };
      }
      if ((requestParams as { path?: string } | undefined)?.path === "openspec/config.yaml") {
        return { data: { content: base64("schema: spec-driven\n") } };
      }
      return { data: [{ name: "add-feature", type: "dir" }] };
    };

    await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(calls.length).toBe(4);
    for (const call of calls) {
      expect(call.headers?.authorization).toBe("Bearer ghs_fake");
      expect(call.headers?.["x-github-api-version"]).toBe(GITHUB_API_VERSION);
      expect(call.headers?.accept).toBe(GITHUB_ACCEPT_HEADER);
    }
  });
});

// Task 6.2: specs/openspec-discovery/spec.md "Edge case — openspec/config.yml
// exists without openspec/config.yaml" — `.yml` is never treated as
// equivalent to the exact `.yaml` path design.md Decision 6 step 2 requires.
describe("classifyOpenSpecSupport — openspec/config.yml is not equivalent to openspec/config.yaml", () => {
  it("a repository with only openspec/config.yml (GitHub 404s the exact .yaml path) classifies as unsupported, and the reason names openspec/config.yaml", async () => {
    const request: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "abc123" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        // The repository's file lives at openspec/config.yml, so GitHub 404s
        // the exact .yaml path the classifier requests — it never falls back
        // to asking for .yml.
        throw githubError(404);
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report.status).toBe("unsupported");
    expect(report.reason).toContain("openspec/config.yaml");
    expect(report.reason).toContain("not found");
  });
});

// Task 6.3: specs/openspec-discovery/spec.md "Failure — config file is not
// parseable YAML" and "Edge case — config exists without openspec/changes/".
// Both are `unsupported`, but for a caller (or a person debugging a report)
// to tell them apart, their reasons must not collapse to the same string.
describe("classifyOpenSpecSupport — invalid config YAML vs a missing openspec/changes/ directory", () => {
  it("produces distinct unsupported reasons for a YAML parse failure and a missing changes/ directory", async () => {
    const invalidYamlRequest: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "abc123" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        // An unterminated flow sequence — yaml's parser throws on this.
        return { data: { content: base64("schema: [not, closed") } };
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const missingChangesRequest: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "abc123" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        return { data: { content: base64("schema: spec-driven\n") } };
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/changes") {
        throw githubError(404);
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const invalidYamlReport = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: invalidYamlRequest,
    });
    const missingChangesReport = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request: missingChangesRequest,
    });

    expect(invalidYamlReport.status).toBe("unsupported");
    expect(missingChangesReport.status).toBe("unsupported");
    expect(invalidYamlReport.reason).toContain("could not be parsed");
    expect(missingChangesReport.reason).toContain("openspec/changes");
    expect(invalidYamlReport.reason).not.toBe(missingChangesReport.reason);
  });
});

// Task 6.4: specs/openspec-discovery/spec.md "Edge case — default branch is
// not main or master" — OpenSpec files are looked up on the repository's
// actual default branch; `main` is never queried when it isn't that branch.
describe("classifyOpenSpecSupport — looks up OpenSpec files on the actual default branch, not main", () => {
  it("a trunk default branch is used for the ref lookup and both contents reads; main is never queried", async () => {
    const calls: Array<{ route: string; ref: unknown }> = [];
    const request: GithubRequestFn = async (route, requestParams) => {
      const ref = (requestParams as { ref?: unknown } | undefined)?.ref;
      calls.push({ route, ref });
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "trunk" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "trunk-sha" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        return { data: { content: base64("schema: spec-driven\n") } };
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/changes") {
        return { data: [{ name: "add-feature", type: "dir" }] };
      }
      throw new Error(`unexpected route in test fixture: ${route}`);
    };

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report.status).toBe("supported");
    expect(report.defaultBranch).toBe("trunk");

    const refCall = calls.find((call) => call.route === "GET /repos/{owner}/{repo}/git/ref/{ref}");
    expect(refCall?.ref).toBe("heads/trunk");

    const contentsCalls = calls.filter((call) => call.route === "GET /repos/{owner}/{repo}/contents/{path}");
    expect(contentsCalls.length).toBe(2);
    for (const call of contentsCalls) {
      expect(call.ref).toBe("trunk");
    }
    expect(calls.some((call) => call.ref === "main" || call.ref === "heads/main")).toBe(false);
  });
});

// Task 6.5: specs/openspec-discovery/spec.md "Failure — repository metadata
// cannot be read" and "Failure — GitHub contents read is forbidden" — a
// 401/403 anywhere discovery reads classifies as permission-blocked, names
// the access error, and never invents a default branch or writes anything
// (the fixtures below throw on any route they were not told to expect, so a
// write attempt would fail the test outright even without the explicit
// GET-only assertion).
describe("classifyOpenSpecSupport — 401/403 reads classify as permission-blocked", () => {
  it("a forbidden repository-metadata read is permission-blocked, invents no default branch, and names the access error", async () => {
    const request: GithubRequestFn = async (route) => {
      if (route === "GET /repos/{owner}/{repo}") {
        throw githubError(403);
      }
      throw new Error(`unexpected route in test fixture: ${route}`);
    };

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report.status).toBe("permission-blocked");
    expect(report.defaultBranch).toBeNull();
    expect(report.tipSha).toBeNull();
    expect(report.reason).toContain("acme/api-gateway");
    expect(report.reason).toContain("metadata");
  });

  it("a forbidden openspec/config.yaml read (metadata already readable) is permission-blocked, names the access error, and issues only GET calls", async () => {
    const calls: string[] = [];
    const request: GithubRequestFn = async (route, requestParams) => {
      calls.push(route);
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "trunk" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "trunk-sha" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        throw githubError(401);
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report.status).toBe("permission-blocked");
    expect(report.defaultBranch).toBe("trunk");
    expect(report.reason).toContain("openspec/config.yaml");
    expect(calls.every((route) => route.startsWith("GET "))).toBe(true);
  });

  it("a forbidden openspec/changes read (config already readable) is permission-blocked and names the access error", async () => {
    const request: GithubRequestFn = async (route, requestParams) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { default_branch: "main" } };
      }
      if (route === "GET /repos/{owner}/{repo}/git/ref/{ref}") {
        return { data: { object: { sha: "abc123" } } };
      }
      const path = (requestParams as { path?: string } | undefined)?.path;
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/config.yaml") {
        return { data: { content: base64("schema: spec-driven\n") } };
      }
      if (route === "GET /repos/{owner}/{repo}/contents/{path}" && path === "openspec/changes") {
        throw githubError(403);
      }
      throw new Error(`unexpected route in test fixture: ${route} path=${String(path)}`);
    };

    const report = await classifyOpenSpecSupport({
      owner: "acme",
      repo: "api-gateway",
      installationToken: "ghs_fake",
      request,
    });

    expect(report.status).toBe("permission-blocked");
    expect(report.defaultBranch).toBe("main");
    expect(report.reason).toContain("openspec/changes");
  });
});
