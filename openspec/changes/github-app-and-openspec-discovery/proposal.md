## Why

Jumphour cannot safely take ideas into a repository-owned OpenSpec change until it knows which GitHub repositories a team may use, who may see them, and whether each repository already has a supported OpenSpec layout. Guessing those facts from a board mock or a personal token would recreate the mutable tracker this product exists to avoid. This change is first because intake, attended launches, optional Promote, and the evidence-derived board all hang on that install, identity, and discovery contract.

## What Changes

- Register Jumphour as a **shareable GitHub App** (not a personal-access-token tool) that an organization administrator can install for **selected repositories**.
- Let a GitHub-authenticated user **sign in** and see only repositories that are both in that installation and accessible to that user.
- For each listed repository, return a **validated discovery report**: default branch, OpenSpec support status, config path/schema when found, and a missing-permission diagnosis when discovery cannot complete.
- Treat a repository without a discoverable OpenSpec layout as **unsupported**. Never invent a change directory or template set.
- Request the **minimum permission set** later Promote will need (`metadata: read`, `contents: write`, `pull_requests: write`) at install time, and **perform no GitHub writes** in this change. If a required permission is missing, fail closed and name the gap.
- Isolate discovery records by **GitHub App installation**. Installation A’s repositories and reports never appear under installation B.
- Provide a **thin signed-in surface**: accessible repositories plus discovery status. Not the four-column board.

Out of scope: MCP idea intake and snapshots, attended Claude Code / Interlock launches, Promote branch/commit/PR writes, OpenSpec initialization of unsupported repos, webhooks as a status graph, source write-back, product RBAC beyond GitHub, and Claude Design prototype work.

## Capabilities

### New Capabilities

- `github-app-installation`: Shareable GitHub App install for selected repositories, GitHub user sign-in, installation-scoped accessible repository listing, permission fail-closed checks, and installation tenancy.
- `openspec-discovery`: Read-only detection of a repository’s default branch and OpenSpec layout/status from GitHub, including unsupported and permission-blocked outcomes.

Discovery is specified as its own capability rather than a slice of `openspec-promotion`. Promote writes remain a later change that will consume these discovery results.

### Modified Capabilities

- None. The main spec inventory is empty.

## Impact

Greenfield: there is no application code, no existing capability specs, and no locked application stack in `openspec/config.yaml`. Implementation introduces a GitHub App registration, GitHub user OAuth / user-to-server tokens, installation persistence, GitHub REST reads for repository metadata and `openspec/config.yaml`, and a minimal signed-in repository/discovery view.

**Assumptions (from epic exploration; recorded so later changes do not reopen them silently):**

- Distribution is a **private, invite-only / single-organization** App, not public Marketplace listing.
- V1 identity is **GitHub user + App installation only**. MCP adapter identity is a later change.
- V1 **workspace is 1:1 with a GitHub App installation**.
- OpenSpec is **supported** only when `openspec/config.yaml` is present and parseable on the default branch, with a discoverable conventional change layout. Unsupported repos are listed, not initialized.
- Claude Design UI is **not a dependency**. This change’s install/sign-in/discovery surfaces are not covered by the board prototype prompt.

**Deferred (must not leak into this change):** exact Promote commit authorship (App vs user), extra confirmation immediately before a write, MCP ↔ GitHub identity join, four-column projection, and initializing OpenSpec in a repository that lacks it.
