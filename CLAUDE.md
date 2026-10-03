# Jumphour — project instructions

## Stack

Decided 2026-09-18. This settles task 1.1 of the `github-app-and-openspec-discovery`
change, which `design.md` (Decision 9) deliberately left to apply time. Wave 1
implements this table rather than re-deciding it.

| Concern | Choice |
|---|---|
| Runtime | Node 24, TypeScript |
| Web framework | Next.js (App Router) — server routes hold the App private key, OAuth callback, and GitHub REST; React renders the signed-in surface |
| GitHub client | `octokit` REST |
| YAML parser | `yaml` |
| SQL store | SQLite today, written Postgres-portable |
| Unit tests | `vitest` |
| Typecheck | `tsc --noEmit` |

**Version pinning.** Resolve the exact current version of every dependency at
install time and pin it literally in `package.json` — no `^`, no `~`, no
`latest`. Do not copy version numbers from memory; read them from the registry
at install and commit the lockfile.

**Required `package.json` scripts.** `.claude/testing/profile.json` invokes these
by name, and the ship run's inter-wave checkpoint treats a failing `typecheck`
as halting:

- `test` → `vitest run`
- `typecheck` → `tsc --noEmit`

### Database portability

SQLite is the store for this change; Postgres is the later target. Keep the swap
cheap:

- All SQL is portable ANSI — no `jsonb`, no SQLite-only or Postgres-only syntax,
  no dialect-specific `RETURNING` tricks.
- Every query goes through one driver interface. Call sites never import the
  SQLite package directly, so replacing the driver is a one-file change.
- Migrations are plain `.sql` files applied in order by a small runner, so they
  read the same against either engine.

## Testing

<!-- BEGIN interlock:testing -->
**Unit:** `npm test` (cwd: `.`)
**Filter:** `npm test -- -t <pattern>`
**Single file:** `npm test -- path/to/file.test.ts`
**E2E:** opt-in via `/interlock:fix-tests --e2e` (not configured)
**Prerequisites:** none
**Profile:** `.claude/testing/profile.json` (managed by `/interlock:fix-tests`)
<!-- END interlock:testing -->

The profile was authored before the app existed, so it is a contract wave 1 must
satisfy rather than a discovery result. Re-run `/interlock:fix-tests` once
`package.json` lands to replace it with real discovery.

## GitHub access

This change performs **zero** GitHub writes. No `POST`/`PUT`/`PATCH`/`DELETE` to
repo, git, contents, or pull-request paths — `contents: write` and
`pull_requests: write` are requested at install for a later change and stay
unused here. Every REST call sends `X-GitHub-Api-Version: 2026-03-10` and
`Accept: application/vnd.github+json`.

Secrets (App private key, OAuth client secret) come from the environment and
never enter git.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
