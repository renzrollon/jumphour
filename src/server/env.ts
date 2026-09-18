// Server-only secret access. Every value here MUST come from
// process.env — never a literal, never checked into git (CLAUDE.md
// "GitHub access" / design.md Decision 7). This module is imported only
// by server-side code (route handlers, server components); it must never
// be imported from a "use client" component, which would bundle it (and
// any values a caller logs) for the browser.
//
// Names are provisional for this bootstrap task: task 3.1 (App JWT /
// installation tokens) and 3.4 (OAuth sign-in) are the first real readers
// and may extend this shape, but should keep reading process.env here
// rather than re-reading process.env directly.

export interface Env {
  githubAppId: string | undefined;
  githubAppPrivateKey: string | undefined;
  githubAppClientId: string | undefined;
  githubAppClientSecret: string | undefined;
  databasePath: string | undefined;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Reads secrets/config from the environment. Never caches or logs values. */
export function getEnv(): Env {
  return {
    githubAppId: readOptional("GITHUB_APP_ID"),
    githubAppPrivateKey: readOptional("GITHUB_APP_PRIVATE_KEY"),
    githubAppClientId: readOptional("GITHUB_APP_CLIENT_ID"),
    githubAppClientSecret: readOptional("GITHUB_APP_CLIENT_SECRET"),
    databasePath: readOptional("DATABASE_PATH"),
  };
}
