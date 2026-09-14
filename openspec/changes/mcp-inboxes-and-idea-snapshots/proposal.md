## Why

An idea that never becomes a frozen, attributable snapshot is already lost: the source issue can change, a URL is not evidence, and a GitHub App that only lists repositories cannot tell a team *what intent* was considered. This change is next because intake is the product’s distinct read boundary. It can be specified without GitHub writes, and later launches, Promote, and the board all need an Idea that already has provenance.

## What Changes

- Add **read-only MCP inboxes** for GitHub Issues, GitLab issues, and Jira, plus a **local manual inbox**, all scoped to the current GitHub App installation from `github-app-and-openspec-discovery`.
- Run an **Idea-lane listener every five minutes** over configured inboxes, recording last attempt / last success, with bounded retry/backoff on failure. Show last-heard state on the intake surface.
- Let a user invoke **Load ideas** for selected configured inboxes (GitHub, GitLab, Jira via MCP, Manual). That is an immediate read, not sync and not a source mutation.
- Show **candidates** before save. **Saving** creates an immutable snapshot (normalized fields, content hash, fetch time, adapter identity/version, canonical permalink when imported).
- **Refresh** of a saved imported idea creates a **new** snapshot and MUST NOT rewrite earlier rows (including any snapshot later marked as used for promotion).
- Let a user **compose a manual idea** with required title and description, optional supporting links, author/time attribution, and a Manual label. No repository and no owner/assignee field.
- Treat imported bodies as **untrusted data**: sanitize for display; never interpret as commands, repository selection, or executable configuration.
- **Never write** comments, labels, transitions, assignments, or other mutations to GitHub Issues, GitLab, or Jira.
- Isolate ideas and snapshots by **installation**. Installation A’s snapshots never appear in B.
- Provide an **intake surface** (Load ideas, candidates, saved ideas, compose, idea-detail provenance) beside Change 1’s thin repository/discovery view. Not the four-column board.

Out of scope: GitHub branch/commit/PR writes, attended Interlock launches, PR/MR fetch, workflow projection, webhooks, MCP↔GitHub identity join beyond a per-installation connector stub, OpenSpec discovery re-classification, and Claude Design board chrome (assignee filters, repo-required compose, four columns).

## Capabilities

### New Capabilities

- `idea-intake`: Configure/select inboxes, five-minute Idea listener, Load ideas, candidates vs save, manual compose, last-heard/backoff, installation-scoped idea list.
- `source-provenance`: Immutable snapshots and content hashes, permalink vs manual labeling, snapshot history, untrusted-content rules, no source write-back, tenancy isolation, retention/deletion.

### Modified Capabilities

- None. Main spec inventory is empty. This change **consumes** in-flight `github-app-installation` (tenancy, GitHub session) and MUST NOT modify `openspec-discovery`.

## Impact

Still greenfield application code. Implementation adds MCP adapter ports (GitHub Issues, GitLab issues, Jira) plus Manual, snapshot persistence FK’d to Change 1 `installations` / `users`, an Idea-lane scheduler, and intake UI. No GitHub write APIs. No four-column board.

**Assumptions:**

- Tenancy key is Change 1’s **`installation_id`** (workspace 1:1 with installation). Do not invent a second workspace table.
- MCP credentials in V1 are a **per-installation service connector** (encrypted reference). User must be signed in to that installation to Load/listen. Per-user OAuth and GitHub↔Jira identity mapping stay deferred (epic Q12).
- **Import without a repository or Promote path is allowed** (epic Q13).
- Manual schema is **title + description** (required), optional links; not the design-prompt’s required repository / suggested owner.
- Retention: keep snapshots **90 days** after last save/refresh/view; a signed-in user in the installation may soft-delete an Idea; hard-delete after retention. Once Promote exists, a snapshot referenced by a promotion MUST NOT be hard-deleted (forward constraint).
- External adapters may be `available`, `unavailable`, or `misconfigured` at runtime. Manual always works. Do not claim production MCP servers are deployed.
- Load ideas → Manual re-reads the **local** manual inbox. **Compose** is the only create path for manual ideas.
- Idea-lane last-heard chrome belongs on the intake list, not on four board columns.

**Deferred:** MCP per-user OAuth join, Promote-linked snapshot selection UX beyond “do not overwrite earlier rows,” session-artifact adapters, and the evidence-derived board.
