## Context

See `proposal.md` for why this is first. The repo is greenfield: no application code, no capability specs on `main`, and no stack lock in `openspec/config.yaml`. Product constraints that shape the approach are in `docs/jumphour-epic-brief.md` (GitHub App as write-plane credential, discover-don’t-invent OpenSpec layout, installation tenancy). Claude Design UI is not an input to this design.

Behavioral contracts: `specs/github-app-installation/spec.md` and `specs/openspec-discovery/spec.md`.

## Goals / Non-Goals

**Goals:**

- A private GitHub App plus GitHub user sign-in that can record an installation and list the user∩installation repository set.
- One discovery classifier that emits canonical repository identity, default branch, and OpenSpec support status for that set.
- A persistence and tenancy model later intake/launch/Promote/board can hang off without a second auth plane.
- A thin signed-in repository/discovery view sufficient to prove the contract.

**Non-Goals:**

- Framework/library selection beyond “a web app with a server and a SQL store” (pin exact versions in the first apply task).
- Webhook-driven mirroring of GitHub events.
- Writing OpenSpec files, branches, or pull requests.
- MCP identity, idea snapshots, attended CLI, or the four-column board.

## Decisions

### 1. Private GitHub App; record install via Setup URL, not a webhook graph

Register Jumphour as a **private** GitHub App (invite-only / single organization). After install, GitHub redirects the administrator to the App **Setup URL** with `installation_id` (and `setup_action`). Persist that installation then. Do not require GitHub webhooks to make install visible.

**Why:** The epic forbids a webhook graph for board freshness. Setup URL is a request/response GitHub already owns. A webhook later can refresh permission or repo selection without becoming the source of truth.

**Rejected:** Personal access tokens as the product credential. Public Marketplace listing in this change. Treating `installation` webhooks as required for V1.

### 2. Two GitHub credentials, two jobs

| Credential | How obtained | Used for |
| --- | --- | --- |
| GitHub App JWT → installation access token | App id + private key | Read installation permission snapshot (`GET /app/installations/{id}`); optional App-side metadata. **Never** used to show a user repositories they cannot access. |
| User-to-server token (GitHub App OAuth) | User sign-in | Session identity; `GET /user/installations`; `GET /user/installations/{installation_id}/repositories` (GitHub’s intersection). |

GitHub REST calls MUST send `X-GitHub-Api-Version: 2026-03-10` and `Accept: application/vnd.github+json`.

**Why:** User listing must be the intersection, or a user with no repo access would see every installed private repo. Installation tokens are for App-level facts (permissions granted to the App), not the user-facing list.

**Rejected:** Installation token as the only credential. Product RBAC that shadows GitHub.

### 3. Workspace is 1:1 with a GitHub App installation

The tenancy key is GitHub `installation_id`. A signed-in user who belongs to multiple installations gets an installation switcher; lists and reports never merge.

**Why:** The epic requires installation/workspace isolation and left the noun ambiguous. One installation = one workspace is the smallest model that satisfies tenancy without inventing a parent “org workspace.”

**Rejected:** One Jumphour workspace spanning many installations in V1 (Change 6). Mapping workspace to GitHub Organization independently of installation.

### 4. Canonical identities — normalize once at the GitHub boundary

This change introduces shared/derived values. Normalize at the adapter; every consumer reads the canonical form.

| Value | Canonical form | Where computed | Readers in this change | Future readers (must keep consuming canonical form) |
| --- | --- | --- | --- | --- |
| Repository identity | GitHub repository numeric `id` as durable key; `full_name` (`owner/name`) is GitHub’s display alias and MAY change | GitHub list/metadata response, stored as `github_repo_id` + `full_name` | Accessible-repo list UI; discovery store; request authorization | Intake repo picker, launch cwd mapping, Promote target, board filter |
| OpenSpec support status | Exactly one of `supported` \| `unsupported` \| `permission-blocked` | Discovery classifier (single function) | Discovery report UI | Promote fail-closed, launch eligibility, board “Needs attention” |
| Tenancy | GitHub `installation_id` | Setup URL / `GET /user/installations` | All queries | Snapshots, launch records, promotions |

User-typed `owner/name` is **input**, not identity. Resolve through GitHub (or a stored row keyed by `github_repo_id`) before compare. Mixed-case `Acme/API-Gateway` and `acme/api-gateway` MUST become one `github_repo_id`. Do not `===` raw strings in UI, cache keys, or SQL besides looking up the stored canonical `full_name` after GitHub resolution.

Support status MUST NOT be recomputed in the UI by inspecting raw file lists. If a screen needs a reason string, it reads `status` + `reason` from the report.

### 5. Request write permissions at install; perform zero writes

App repository permissions (GitHub names):

| Permission | Access | Purpose now | Purpose later |
| --- | --- | --- | --- |
| `metadata` | read | `GET /repos/{owner}/{repo}`, default branch, listing | Unchanged |
| `contents` | write | Discovery **reads** file/dir contents (`GET .../contents/openspec/config.yaml`, `GET .../contents/openspec/changes`). Write is unused. | Promote branch/commit (Change 4) |
| `pull_requests` | write | Unused in this change; presence is checked | Draft PR create (Change 4) |

Explicitly **not** requested: organization administration, Actions, Issues, anything outside the installation.

If `GET /app/installations/{id}` shows a required permission missing or not `write` where write is required, surface the gap. Discovery and listing still use reads when GitHub allows them; **no** compensating write.

**Why:** Requesting the Promote set now avoids a later permission-upgrade dance. The spec still forbids writes, so a leaked “create branch” call is a spec failure, not a convenience.

**Rejected:** Contents read-only now, upgrade later. Requesting Issues write “just in case.”

### 6. Discovery classifier (read-only)

For each user-accessible repository in the current installation:

1. `GET /repos/{owner}/{repo}` → `default_branch`; resolve tip SHA (`GET /repos/{owner}/{repo}/git/ref/heads/{default_branch}` or the repo’s default-branch commit URL). If this fails with 401/403 (or equivalent permission error), status = `permission-blocked`. Do not invent `main`.
2. `GET /repos/{owner}/{repo}/contents/openspec/config.yaml?ref={default_branch}`. Path is exact; `openspec/config.yml` does not count.
3. `GET /repos/{owner}/{repo}/contents/openspec/changes?ref={default_branch}` and require GitHub `type` = `dir` (or an equivalent directory listing).
4. If config contents are returned, parse YAML. Missing `schema` is allowed; invalid YAML → `unsupported`.
5. Status = `supported` only when steps 2–4 succeed and `openspec/changes/` is a directory. Else if contents were readable, `unsupported` with a specific reason. Else `permission-blocked`.

All GitHub calls are GET (plus GitHub’s blob/ref reads). No `PUT`/`POST`/`PATCH`/`DELETE` to repos, git refs, contents, or pulls.

Cache reports per `(installation_id, github_repo_id)` with `observed_at`. Refresh on explicit user refresh and when the repository list is loaded if the report is absent. Do not treat cache as more authoritative than GitHub; on refresh, overwrite the report.

### 7. Persistence (minimum product database)

Git cannot hold installation membership or snapshots of permission checks. Store:

- `installations` — `github_installation_id` (unique), account id/login, permission snapshot, timestamps
- `users` — `github_user_id` (unique), login
- `sessions` — signed-in GitHub user, current `installation_id`
- `installation_repositories` — (`installation_id`, `github_repo_id`), canonical `full_name`, timestamps
- `discovery_reports` — (`installation_id`, `github_repo_id`), default branch, tip SHA, `status`, `config_path`, optional `schema`, `reason`, `observed_at`

App private key and OAuth client secret stay in environment/secret storage, never in git.

### 8. Thin signed-in surface

Screens: GitHub sign-in; post-install Setup URL completion; installation picker when needed; repository table (canonical `full_name`, default branch, support status, reason); retry/refresh. No four-column board, no compose-idea, no Promote, no Claude Code panel.

Empty and error copy must distinguish: App not installed, user has no overlapping repos, GitHub listing failed, `unsupported`, `permission-blocked`.

**Refresh acquires a user token by redirecting through OAuth.** Refresh must re-run listing as well as discovery, and listing (`GET /user/installations/{id}/repositories`) requires the user-to-server token per Decision 2 — which Decision 7 deliberately never stores. A Refresh request therefore holds no credential that can list, and an installation token must not be substituted: it authenticates as the App and would expose repositories the user cannot access. So Refresh redirects through GitHub's OAuth authorize endpoint, carrying the current installation in the OAuth `state` parameter, and the callback performs listing (user token) then discovery (installation token). Where the user's GitHub session is live and the App already authorized, the round trip is invisible.

Two consequences are load-bearing: the callback creates a *new* session with `installation_id` NULL, so the installation must survive the trip in `state` and be re-bound on return; and `state` arrives from the browser, so the named installation is accepted only if GitHub's own fresh `GET /user/installations` confirms it for this user.

**Rejected:** persisting the user's OAuth access token so Refresh can list directly — it contradicts Decision 7 and the "stores no token" guarantee. **Deferred:** an anti-CSRF nonce in `state`, which this change does not issue or verify; it must be added as an additional `state` component, not as a replacement for the refresh marker.

### 9. Application stack is chosen and pinned at apply time

Implement as one web application with a server (holds App credentials, OAuth, GitHub REST, SQL). Do not treat Claude Design, a frontend prototype, or an unpinned “latest” framework as the stack. The first implementation task MUST record exact runtime, web framework, GitHub client, YAML parser, and database versions before product code lands. This design does not name those libraries so it does not invent versions.

## Risks / Trade-offs

- **[Write permissions unused]** → Reviewers may distrust unused `contents: write` / `pull_requests: write`. Mitigation: document purpose in the App listing; automated tests assert this change performs no GitHub writes; later Promote is the only writer.
- **[Setup URL missed]** → Admin closes the GitHub tab before redirect. Mitigation: signed-in user can link an installation via `GET /user/installations` and persist any not yet stored; do not require webhook to recover.
- **[Stale `full_name`]** → Rename creates a second row if identity is the string. Mitigation: key by `github_repo_id`; update `full_name` on refresh (spec edge case).
- **[UI recomputes support]** → Duplicate classifiers drift. Mitigation: one classifier; UI reads `status`/`reason` only (invariant sweep).
- **[GitHub rate limits]** → Discover-on-list for many repos. Mitigation: per-repo report cache; refresh explicit; backoff and show listing/discovery failure rather than partial invention.
- **[Private App limits distribution]** → Correct for V1; Change 6 revisits public install.

## Migration Plan

- **Deploy:** Register the private GitHub App in the target org; set Setup URL and OAuth callback to the deployed app; store App id, private key, client id/secret; run storage migrations; enable sign-in.
- **Rollback:** Disable the App (or uninstall); take the app out of service. No GitHub repo mutations to undo. Drop or keep SQL rows; they are not GitHub source of truth.
- **Forward:** Later changes add FK rows pointing at `(installation_id, github_repo_id)` and MUST keep reading canonical `status` rather than re-deriving it from raw GitHub payloads in those features.

## Open Questions

- Exact hosting environment (local-only vs a shared staging URL for the Setup callback) does not change specs; apply can start with a documented local callback for the first organization.
- Whether later implementation commits are authored as the App or the user is deferred to Promote (Change 4) and does not change this discovery design.
