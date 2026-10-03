// Task 6.1: design.md Decision 6 ("Discovery classifier (read-only)") and
// specs/openspec-discovery/spec.md "Classify OpenSpec support from the
// default branch". One function reads GitHub's default branch + tip SHA,
// `openspec/config.yaml` on that ref, and whether `openspec/changes/` is a
// directory, then computes the single canonical status
// (`supported` | `unsupported` | `permission-blocked`) every later consumer
// reads rather than re-deriving (design.md Decision 4: "UI recomputes
// support" risk — "one classifier; UI reads status/reason only"). This task
// only requires the happy path (config parses, `openspec/changes/` is a
// directory -> `supported`, with `configPath` and the optional `schema`
// field); tasks 6.2-6.5 extend this same function's other branches with the
// remaining spec scenarios (`.yml`-only, invalid YAML, missing changes/,
// permission-blocked, non-main branches) — see
// ./classify-openspec-support.test.ts.
//
// Reads use the installation access token (task 3.1's mintInstallationToken
// output), not a signed-in user's OAuth token: design.md Decision 2 reserves
// the user token for the accessible-repository intersection (task 4.1),
// while Decision 5 grants the App installation `contents` read/write for
// exactly this discovery read. Every call here is a GET; nothing writes to
// GitHub (CLAUDE.md "GitHub access").
import { parse as parseYaml } from "yaml";
import { createOctokitRequest, githubRequiredHeaders, type GithubRequestFn } from "./request";

export type OpenSpecSupportStatus = "supported" | "unsupported" | "permission-blocked";

export interface OpenSpecDiscoveryReport {
  status: OpenSpecSupportStatus;
  /** GitHub's default branch name, or null when repository metadata could
   * not be read at all (design.md Decision 6 step 1: "Do not invent main"). */
  defaultBranch: string | null;
  /** Tip commit SHA of `defaultBranch`, or null alongside a null defaultBranch. */
  tipSha: string | null;
  /** Present only when status is `supported`: the exact path checked. */
  configPath?: string;
  /** The parsed config's `schema` field, when present — "Missing schema is
   * allowed" (design.md Decision 6 step 4). */
  schema?: string;
  /** Human-readable explanation for `unsupported` / `permission-blocked`. */
  reason?: string;
}

export interface ClassifyOpenSpecSupportParams {
  owner: string;
  repo: string;
  /** Installation access token (task 3.1's mintInstallationToken) — never a
   * signed-in user's OAuth token; see module comment. */
  installationToken: string;
  /** Test seam: inject a fake in place of the default Octokit-backed
   * request function so tests never reach the network. */
  request?: GithubRequestFn;
}

const CONFIG_PATH = "openspec/config.yaml";
const CHANGES_PATH = "openspec/changes";

function authHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    ...githubRequiredHeaders(),
  };
}

/** Octokit's `RequestError` (and this module's test fakes, by the same
 * convention) carry the GitHub HTTP status on `.status`. Used only to tell
 * "path does not exist" (404 — GitHub read fine, nothing there) apart from
 * an actual access failure (401/403/anything else). */
function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

interface ReadContentsPathParams {
  owner: string;
  repo: string;
  path: string;
  ref: string;
  token: string;
  request: GithubRequestFn;
}

/** `GET /repos/{owner}/{repo}/contents/{path}?ref={ref}` — GitHub returns a
 * single file object (with base64 `content`) for a file path, or an array of
 * entries for a directory path. Throws (with `.status`) on a non-2xx
 * response, same as every other GithubRequestFn call in this codebase. */
async function readContentsPath(params: ReadContentsPathParams): Promise<unknown> {
  const response = await params.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ref: params.ref,
    headers: authHeaders(params.token),
  });
  return response.data;
}

/**
 * design.md Decision 6, steps 1-5: reads the repository's GitHub default
 * branch and tip commit SHA, then `openspec/config.yaml` and
 * `openspec/changes/` on that exact ref, and classifies OpenSpec support.
 * `status` is `supported` only when the config file exists, parses as YAML,
 * and `openspec/changes/` is a directory
 * (specs/openspec-discovery/spec.md "Classify OpenSpec support from the
 * default branch"). All GitHub calls are GET; none write.
 */
export async function classifyOpenSpecSupport(
  params: ClassifyOpenSpecSupportParams,
): Promise<OpenSpecDiscoveryReport> {
  const { owner, repo, installationToken } = params;
  const request = params.request ?? createOctokitRequest();

  let defaultBranch: string;
  let tipSha: string | null;
  try {
    const repoResponse = await request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
      headers: authHeaders(installationToken),
    });
    defaultBranch = (repoResponse.data as { default_branch: string }).default_branch;

    const refResponse = await request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
      headers: authHeaders(installationToken),
    });
    tipSha = (refResponse.data as { object?: { sha?: string } }).object?.sha ?? null;
  } catch {
    // design.md Decision 6 step 1: metadata unreadable -> permission-blocked,
    // never an invented "main". specs/openspec-discovery/spec.md "Failure —
    // repository metadata cannot be read".
    return {
      status: "permission-blocked",
      defaultBranch: null,
      tipSha: null,
      reason: `GitHub could not read repository metadata for ${owner}/${repo}`,
    };
  }

  const unsupported = (reason: string): OpenSpecDiscoveryReport => ({
    status: "unsupported",
    defaultBranch,
    tipSha,
    reason,
  });
  const permissionBlocked = (reason: string): OpenSpecDiscoveryReport => ({
    status: "permission-blocked",
    defaultBranch,
    tipSha,
    reason,
  });

  let configData: unknown;
  try {
    configData = await readContentsPath({
      owner,
      repo,
      path: CONFIG_PATH,
      ref: defaultBranch,
      token: installationToken,
      request,
    });
  } catch (error) {
    return statusOf(error) === 404
      ? unsupported(`${CONFIG_PATH} was not found on ${defaultBranch}`)
      : permissionBlocked(`GitHub refused to read ${CONFIG_PATH} on ${defaultBranch}`);
  }

  const configFile = configData as { content?: string } | null;
  if (!configFile?.content) {
    // Not a file (e.g. an array came back because the path is a directory)
    // — treated the same as "not found": step 2 requires exactly this path.
    return unsupported(`${CONFIG_PATH} was not found on ${defaultBranch}`);
  }

  let parsedConfig: unknown;
  try {
    parsedConfig = parseYaml(Buffer.from(configFile.content, "base64").toString("utf8"));
  } catch {
    return unsupported(`${CONFIG_PATH} could not be parsed as YAML`);
  }

  let changesData: unknown;
  try {
    changesData = await readContentsPath({
      owner,
      repo,
      path: CHANGES_PATH,
      ref: defaultBranch,
      token: installationToken,
      request,
    });
  } catch (error) {
    return statusOf(error) === 404
      ? unsupported(`${CHANGES_PATH}/ was not found on ${defaultBranch}`)
      : permissionBlocked(`GitHub refused to read ${CHANGES_PATH} on ${defaultBranch}`);
  }

  if (!Array.isArray(changesData)) {
    // A file (or anything else) named `changes` is not the directory step 3
    // requires — GitHub's contents API returns an array only for a directory
    // listing (design.md Decision 6 step 3: "require GitHub type = dir (or
    // an equivalent directory listing)").
    return unsupported(`${CHANGES_PATH}/ was not found on ${defaultBranch}`);
  }

  const schema =
    parsedConfig && typeof parsedConfig === "object" && !Array.isArray(parsedConfig)
      ? (parsedConfig as Record<string, unknown>).schema
      : undefined;

  return {
    status: "supported",
    defaultBranch,
    tipSha,
    configPath: CONFIG_PATH,
    ...(typeof schema === "string" ? { schema } : {}),
  };
}
