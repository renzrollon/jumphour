## Context

See `proposal.md` for why. This change hangs off in-flight `github-app-and-openspec-discovery`: tenancy is GitHub `installation_id`, the actor is `github_user_id`, and Ideas MUST NOT invent a workspace table or a second repo identity. Application code is still greenfield. Behavioral contracts: `specs/idea-intake/spec.md` and `specs/source-provenance/spec.md`.

## Goals / Non-Goals

**Goals:**

- One read-only adapter port for GitHub Issues, GitLab issues, and Jira, plus a local Manual inbox.
- Append-only snapshots with a single content-hash function and a single display sanitizer.
- Idea-lane schedule (5 minutes, bounded backoff) and Load ideas as two triggers over the same read path.
- Intake UI beside Change 1’s repo/discovery surface.

**Non-Goals:**

- Pinning a specific MCP SDK or host (pin at apply, like Change 1’s stack).
- Per-user MCP OAuth or GitHub↔Jira identity join.
- Recomputing OpenSpec discovery status during save.
- Persisting unsaved candidates as Ideas.
- Webhooks, source writes, four-column board.

## Decisions

### 1. Consume Change 1 identity; add intake tables only

FK `installation_id` → Change 1 `installations`. FK manual author / “who saved” → `users.github_user_id`. Do not create `workspaces`. Do not put `github_repo_id` on Idea as required. Optional later binding uses Change 1 `installation_repositories.github_repo_id` when launch/Promote needs it.

New tables:

| Table | Role |
| --- | --- |
| `inbox_connectors` | Per installation, per source kind (`github-issue` \| `gitlab-issue` \| `jira`); encrypted credential reference; runtime status `available` \| `unavailable` \| `misconfigured`; adapter identity/version |
| `ideas` | `installation_id`, `source_kind` (`github-issue` \| `gitlab-issue` \| `jira` \| `manual`), `external_id` (null for manual), `created_by`, `latest_snapshot_id`, `promotion_snapshot_id` (null until Promote), `interpretation` (nullable text, not in snapshot), `soft_deleted_at`, `last_viewed_at` |
| `idea_snapshots` | Immutable rows: `idea_id`, denormalized `installation_id`, normalized payload JSON, `content_hash`, `fetched_at`, adapter identity/version, permalink or manual flag |
| `idea_lane_state` | One row per installation: `last_attempt_at`, `last_success_at`, `consecutive_failures`, `next_attempt_at`, last error |

Unique imported Idea: `(installation_id, source_kind, external_id)` where `external_id` is not null. Saving an already-saved external id **appends a snapshot** to the existing Idea (same as refresh), it does not create a second Idea.

**Rejected:** Keying Ideas by permalink string or `owner/name`. Required repo on `ideas`. Candidate rows in `ideas`.

### 2. Adapter port is read-only by type

```text
InboxAdapter
  listCandidates(connector) -> Candidate[] | AdapterError
  getItem(connector, external_id) -> NormalizedItem | AdapterError
```

No write methods exist on the port. Manual is not an MCP adapter: compose writes `ideas` + first snapshot locally; Load ideas → Manual reads local non-deleted manuals.

`NormalizedItem` maps 1:1 to spec fields. Optional MCP fields that are missing stay null. Imported kinds without permalink **fail save** (do not fabricate URLs). Runtime: each external connector is `available` | `unavailable` | `misconfigured`. Tests use fixtures; production MCP servers are not assumed.

V1 credentials: encrypted **per-installation** connector reference on `inbox_connectors`. Any signed-in user of that installation may Load/listen. No OAuth wizard (design prompt exclusion + epic Q12 deferred).

**Rejected:** Calling GitHub Issues via the GitHub App Issues write permission (Change 1 explicitly does not request Issues). Using installation tokens to import issues as if they were MCP.

### 3. Canonical values — normalize once

| Value | Canonical form | Where computed | Readers now | Future readers |
| --- | --- | --- | --- | --- |
| Imported Idea identity | `(installation_id, source_kind, external_id)` | Save/getItem | Idea list, refresh, uniqueness | Promote link, launch eligibility, board cards |
| Manual Idea identity | `ideas.id` (UUID) in an installation | Compose | List/detail | Same |
| Snapshot identity | Immutable `idea_snapshots.id` | Insert-only | Detail, refresh, retention | `promotion_snapshot_id` |
| Content hash | SHA-256 of canonical JSON (sorted keys) of normalized payload: kind, external_id, permalink, title, body, state, labels, author, source timestamps | Snapshot insert | Provenance UI | Promote “which snapshot” |
| Connector status | `available` \| `unavailable` \| `misconfigured` | Adapter error mapping | Load ideas, listener, health | Board source-health (Change 5) |
| Tenancy | `installation_id` | Change 1 session | All queries | Unchanged |

Display sanitization is a **second** single boundary: `sanitizeForDisplay(snapshot.body)` used by every view. Raw payload stays in storage as data. Do not sanitize-on-write in a way that changes the hash of what was fetched; hash the adapter-normalized text as retrieved.

Imported text MUST NOT flow into connector config, installation switcher, or `github_repo_id`.

### 4. Shared read path for listener and Load ideas

Both call `listCandidates` / local manual read. Listener is a worker that, per installation, runs when `now >= next_attempt_at` (default +5 min). On failure: `consecutive_failures`++, delay min(10 minutes, 1 then 2 then 4 then 8 minutes), store error. On success: reset failures, `last_success_at = now`, `next_attempt_at = now + 5 min`. Load ideas success updates `last_success_at` for that installation (Idea lane freshness) without requiring the user to wait for the timer.

Listener **does not auto-save** candidates. It may refresh last-heard and surface new candidate counts; Ideas appear only on explicit save (or compose). Auto-creating Ideas on poll would silently enlarge the intake list and skip the candidate step.

**Rejected:** Four independent lane pollers in this change. Webhooks. Auto-save on listen.

### 5. Unsaved candidates are ephemeral

Load ideas returns candidates in the response (and optionally a short-lived server cache keyed by `(installation_id, user, load_id)` that expires in minutes). If the cache expires, the user runs Load ideas again. No `ideas` row until save.

### 6. Intake UI beside Change 1, not a board

Screens: inbox health/status (retry, last error — not credential setup); Load ideas picker; candidate list; compose (title, description, optional links); saved-ideas list with source filter and last-heard; idea detail (snapshot, permalink/manual label, hash, time, separate interpretation field, refresh, soft-delete). No assignee filter, no four columns, no Start spec, no Promote.

### 7. Retention worker

Periodic job: hard-delete snapshots with `fetched_at`/`last_viewed_at` older than 90 days when `ideas.promotion_snapshot_id` is not that snapshot and the Idea is not referencing it. Soft-delete sets `soft_deleted_at` and hides from list. Viewing an Idea updates `last_viewed_at`.

### 8. Libraries

Use the same web+SQL app as Change 1. Pin MCP client, markdown sanitizer, and scheduler versions in the first apply task. This design does not invent those versions. Adapter tests MUST assert the GitHub/GitLab/Jira ports never send write methods (empty write surface).

## Risks / Trade-offs

- **[Listener auto-save temptation]** → Spec forbids it; tests assert poll does not insert `ideas`.
- **[Per-installation connector is coarse]** → Anyone in the install can Load that Jira inbox. Mitigation: deferred per-user OAuth (Q12); status-only health UI now.
- **[Hash vs display sanitizer drift]** → Hash retrieved normalized text; sanitize only at render so hostile markup cannot change identity by being stripped before hash.
- **[Same issue, two installations]** → Intentional two Ideas (spec). Operators must not “dedupe globally” by external id.
- **[90-day retention vs audit]** → Documented V1 default; promotion FK blocks hard-delete of selected snapshots.
- **[MCP unavailable]** → Fixtures + `unavailable` status; Manual still works so intake is demonstrable without live Jira.

## Migration Plan

- **Deploy:** Apply SQL for new tables; configure zero or more `inbox_connectors` per installation; start Idea-lane worker; enable intake routes on the signed-in app.
- **Rollback:** Stop the worker; disable intake routes. Snapshots remain in SQL (GitHub/GitLab/Jira unchanged). Drop tables only if abandoning intake.
- **Forward:** Promote sets `promotion_snapshot_id` without mutating snapshot rows. Board Change 5 reads Ideas as the Idea-column input, still using canonical identity and stored hashes.

## Open Questions

- Exact MCP server names in the deployed environment (epic Q17) do not change the port or specs; apply wires whatever is present and marks the rest `unavailable`.
- Whether interpretation notes allow markdown is a render detail; they remain outside snapshot hash either way.
