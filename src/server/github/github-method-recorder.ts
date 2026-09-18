// Task 5.3: specs/github-app-installation/spec.md "Fail closed when required
// GitHub permissions are missing" — "Happy path — required permissions are
// present": "the system proceeds with read-only GitHub operations AND it does
// not create a branch, commit, file, or pull request." CLAUDE.md "GitHub
// access" states the same rule as an absolute for this change: zero GitHub
// writes, with `contents: write` and `pull_requests: write` requested at
// install for a later change and left unused here.
//
// Every GitHub call in this change already funnels through one seam —
// `GithubRequestFn` (./request.ts) — which every module accepts as an
// injectable parameter. That seam is what makes the rule testable rather
// than merely asserted in prose: this module wraps any `GithubRequestFn` and
// records the HTTP method and path of every call made through it, so a test
// can drive the real listing and discovery code paths and then assert on
// what they actually asked GitHub to do.
//
// Why a recorder rather than per-test route assertions: the existing tests
// each hand-write a fixture that throws on "unexpected route", which proves
// a route was not *answered* but not that it was not *attempted* — a call
// that throws still reached GitHub in production. This records the attempt
// itself, before the inner function runs and regardless of whether it
// throws, so an attempted write is caught even when it fails.
//
// This module ships as production source rather than a `.test.ts` helper for
// one reason: it is the executable form of a repository-wide constraint, and
// a later change that starts performing real writes must delete or narrow it
// deliberately, not quietly stop importing a test-only file.
import type { GithubRequestFn } from "./request";

/** HTTP methods a GitHub REST route can name. */
export type HttpMethod = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";

const READ_METHODS: readonly string[] = ["GET", "HEAD", "OPTIONS"];

/** The four methods CLAUDE.md "GitHub access" forbids for this change. */
export const GITHUB_WRITE_METHODS: readonly HttpMethod[] = ["POST", "PUT", "PATCH", "DELETE"];

const KNOWN_METHODS: readonly string[] = [...READ_METHODS, ...GITHUB_WRITE_METHODS];

/**
 * The GitHub path families the task names: "repo, git, contents, or
 * pull-request paths". `git`, `contents` and `pulls` all live under
 * `/repos/...`, so a bare `/repos` prefix would already cover them — they are
 * distinguished anyway so a violation report can name the family it hit,
 * which is what makes a failure message actionable rather than just red.
 */
export type ProtectedPathFamily = "contents" | "git" | "pull-request" | "repo";

/** One outgoing GitHub call, as attempted. */
export interface RecordedGithubCall {
  /** The route string exactly as the caller passed it, e.g. `GET /repos/{owner}/{repo}`. */
  route: string;
  method: HttpMethod;
  /** The route with its method stripped, e.g. `/repos/{owner}/{repo}`. */
  path: string;
  /** Which protected family `path` belongs to, or null if none. */
  family: ProtectedPathFamily | null;
  /** Whether the inner request function threw. A throwing call still counts
   * as an attempt — that is the whole point of recording before awaiting. */
  failed: boolean;
}

/**
 * Splits `"GET /repos/{owner}/{repo}"` into its method and path.
 *
 * A route with no leading method is GET in Octokit's own request signature,
 * and is reported as GET here for the same reason — but only when the first
 * token is not a method at all (i.e. it starts with `/`). An unrecognized
 * leading word is NOT quietly treated as GET: for a harness whose entire job
 * is to catch writes, guessing "read" about something unparseable is the one
 * wrong direction to err in, so it is surfaced as the literal token and will
 * not match any read method.
 */
export function parseGithubRoute(route: string): { method: HttpMethod; path: string } {
  const trimmed = route.trim();
  const separator = trimmed.indexOf(" ");

  if (separator === -1) {
    return { method: "GET", path: trimmed };
  }

  const leading = trimmed.slice(0, separator).toUpperCase();
  const rest = trimmed.slice(separator + 1).trim();

  if (KNOWN_METHODS.includes(leading)) {
    return { method: leading as HttpMethod, path: rest };
  }

  // Not a method we know. Keep it verbatim so `isWriteMethod` does not clear
  // it and a reviewer sees the real token in the failure message.
  return { method: leading as HttpMethod, path: rest };
}

/** True for POST/PUT/PATCH/DELETE, and for any method this module does not
 * recognize as a read — unknown is never treated as safe. */
export function isWriteMethod(method: string): boolean {
  return !READ_METHODS.includes(method.toUpperCase());
}

/**
 * Classifies a GitHub path into one of the protected families, most specific
 * first. Returns null for paths outside them (`/user/installations/...`, for
 * instance, which is the listing call and is not a repo-content path).
 */
export function protectedPathFamily(path: string): ProtectedPathFamily | null {
  if (path.includes("/contents")) return "contents";
  if (path.includes("/git/") || path.endsWith("/git")) return "git";
  if (path.includes("/pulls")) return "pull-request";
  if (path.startsWith("/repos")) return "repo";
  return null;
}

export interface GithubMethodRecorder {
  /** Drop-in replacement for the wrapped `GithubRequestFn`. */
  request: GithubRequestFn;
  /** Every call attempted through `request`, in order. */
  calls: readonly RecordedGithubCall[];
  /** Distinct methods seen, in first-seen order. */
  methods(): HttpMethod[];
  /** Every recorded call whose method is not a read, anywhere. */
  writes(): RecordedGithubCall[];
  /** Every recorded write against a repo, git, contents or pull-request
   * path — the exact set the task forbids. */
  protectedWrites(): RecordedGithubCall[];
  /** Throws naming every offending call, or returns silently. Reads as the
   * assertion the spec scenario states. */
  assertNoGithubWrites(): void;
}

/**
 * Wraps `inner` so every call through the returned `request` is recorded.
 *
 * The recording happens BEFORE `inner` is awaited, so a call that rejects is
 * still recorded (with `failed: true`) — a write that GitHub refused is still
 * a write this change attempted, and the spec forbids the attempt, not just
 * the success.
 *
 * @param inner the request function to wrap; defaults to one that refuses
 *   every call, so a test that forgets to supply fixtures fails loudly
 *   instead of reaching the network.
 */
export function recordGithubMethods(inner?: GithubRequestFn): GithubMethodRecorder {
  const calls: RecordedGithubCall[] = [];
  const wrapped: GithubRequestFn =
    inner ??
    (async (route) => {
      throw new Error(`no request fixture supplied for route: ${route}`);
    });

  const request: GithubRequestFn = async (route, params) => {
    const { method, path } = parseGithubRoute(route);
    const record: RecordedGithubCall = {
      route,
      method,
      path,
      family: protectedPathFamily(path),
      failed: false,
    };
    calls.push(record);

    try {
      return await wrapped(route, params);
    } catch (error) {
      record.failed = true;
      throw error;
    }
  };

  const writes = (): RecordedGithubCall[] => calls.filter((call) => isWriteMethod(call.method));

  const protectedWrites = (): RecordedGithubCall[] => writes().filter((call) => call.family !== null);

  return {
    request,
    calls,
    methods: () => [...new Set(calls.map((call) => call.method))],
    writes,
    protectedWrites,
    assertNoGithubWrites: () => {
      const offenders = protectedWrites();
      if (offenders.length === 0) return;
      const detail = offenders
        .map((call) => `${call.method} ${call.path} (${call.family} path)`)
        .join("; ");
      throw new Error(
        `this change must issue zero GitHub writes, but ${offenders.length} write call(s) were ` +
          `attempted against protected paths: ${detail}`,
      );
    },
  };
}
