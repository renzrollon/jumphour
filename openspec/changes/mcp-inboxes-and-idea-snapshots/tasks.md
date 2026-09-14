## 1. Persistence

- [ ] 1.1 Add `inbox_connectors`, `ideas`, `idea_snapshots`, and `idea_lane_state` FKed to Change 1 `installations` / `users` (no new workspace table, no required `github_repo_id` on ideas), and verify migrations apply on a clean database that already has Change 1 tables
- [ ] 1.2 Enforce unique `(installation_id, source_kind, external_id)` for imported Ideas and append-only snapshots, and verify a second save of the same GitLab id adds a snapshot rather than a second Idea
- [ ] 1.3 Store `source_kind` only as `github-issue` | `gitlab-issue` | `jira` | `manual` and connector status only as `available` | `unavailable` | `misconfigured`, and verify invalid enum writes fail

## 2. Adapter port

- [ ] 2.1 Define a read-only inbox adapter port (`listCandidates`, `getItem` only) with fixture adapters for GitHub Issues, GitLab issues, and Jira, and verify a type/test that the port exposes no write methods
- [ ] 2.2 Map adapter results to normalized fields (kind, external id, permalink, title, body, state, labels, author, source timestamps, adapter id/version) leaving missing optionals null, and verify a fixture with omitted labels does not invent them
- [ ] 2.3 Reject save when an imported item has no canonical permalink, and verify no snapshot row is written and no URL is fabricated
- [ ] 2.4 Surface connector runtime as `unavailable` or `misconfigured` without an OAuth wizard, and verify Load ideas on a misconfigured Jira inbox reports that status and returns no invented Jira candidates
- [ ] 2.5 Pin MCP client / fixture library versions in the app manifest (no `^`/`~`/`latest`) when one is introduced, and verify install succeeds

## 3. Snapshots and hash

- [ ] 3.1 Compute `content_hash` once at snapshot insert as SHA-256 of canonical sorted-key JSON of the normalized payload, and verify two inserts of the same payload share a hash and UI/API readers display the stored hash rather than recomputing from a different field set
- [ ] 3.2 Implement refresh as insert-new-snapshot, and verify S1 bytes/hash/timestamp are unchanged after S2 is stored
- [ ] 3.3 Keep `promotion_snapshot_id` from being overwritten by refresh, and verify a marked S1 remains byte-identical after a later refresh
- [ ] 3.4 Store interpretation notes on the Idea, not in snapshot JSON, and verify editing notes does not change snapshot hash or body

## 4. Untrusted content and no source writes

- [ ] 4.1 Implement a single `sanitizeForDisplay` used by all snapshot views, and verify script tags and prompt-like “select repository X” text are not executed and do not change installation, inbox, or `github_repo_id`
- [ ] 4.2 Hash retrieved text (not the sanitized HTML) so sanitizer changes cannot alter identity, and verify hostile markup still hashes stably from the stored payload
- [ ] 4.3 Add a test harness that records adapter/HTTP methods during Load ideas, listen, save, and refresh, and verify no source write (comment, label, transition, assign) is issued
- [ ] 4.4 Saving an issue body that names a repository does not bind the Idea to that repo, and verify `github_repo_id` stays null and Change 1 discovery rows are untouched

## 5. Intake actions

- [ ] 5.1 Implement Load ideas for selected configured inboxes plus always-on Manual, returning ephemeral candidates (no `ideas` insert until save), and verify dismissing candidates leaves the ideas table unchanged
- [ ] 5.2 Saving a candidate creates an installation-scoped Idea + snapshot, and verify GitLab happy-path stores permalink, hash, fetch time, and adapter identity without requiring a repository
- [ ] 5.3 Compose manual Ideas with non-empty title and description, optional links, Manual label, author, created time, and no permalink/repo/owner fields, and verify empty title or description is rejected
- [ ] 5.4 Load ideas with only Manual selected re-reads local manuals and does not compose, and verify idea count is unchanged
- [ ] 5.5 Successful Load ideas updates `idea_lane_state.last_success_at`, and verify last-heard on the intake surface reflects that time

## 6. Listener and backoff

- [ ] 6.1 Run the Idea listener per installation every five minutes without auto-saving candidates, and verify a successful tick updates last-heard and does not insert `ideas`
- [ ] 6.2 On listen failure, keep existing Ideas, record last error, and delay the next attempt using 1→2→4→8 minutes capped at 10, and verify no tight retry loop in the fixture
- [ ] 6.3 After a later success, reset interval to five minutes, and verify `consecutive_failures` returns to 0

## 7. Tenancy, retention, and surface

- [ ] 7.1 Scope every idea/snapshot/connector query by current `installation_id`, and verify installation B cannot read A’s titles, permalinks, bodies, or hashes (including when content hashes match)
- [ ] 7.2 Switching installations replaces the intake list and last-heard (no merge), and verify the switcher reuses Change 1 installation context
- [ ] 7.3 Soft-delete hides an Idea from the list without source write-back, and verify the source fixture is unchanged
- [ ] 7.4 Retention hard-deletes unreferenced snapshots older than 90 days since last save/refresh/view but skips `promotion_snapshot_id`, and verify that skip with a fixture older than 90 days
- [ ] 7.5 Build the intake surface (Load ideas, candidates, compose, saved list, detail, last-heard, source health) beside Change 1’s repo/discovery view, and verify no Idea / OpenSpec change / In progress / PR/MR columns, no assignee filter, and no Promote/Start spec actions
- [ ] 7.6 Empty intake offers Load ideas and compose, and verify copy does not describe a missing board
- [ ] 7.7 Save succeeds even when Change 1 discovery is `unsupported`, and verify the Idea row exists
