## Context

See `proposal.md` for why. This design is an **amendment**, written 2026-09-19, after an artifact review blocked the change as originally authored on 2026-09-14 (0 of its tasks applied). Four blockers, one line each:

- **A second surface.** The change specified an "intake surface without workflow board columns" beside the repository view, while `workflow-board-ui` made `/` the four-lane board and recorded that this change "must be re-pointed before it is applied" (`workflow-board-ui/proposal.md:38`).
- **Stored values never reached a view model.** The change named no board type at all and deferred the board to a later change that no longer owns it.
- **A display sanitizer that contradicts the rendering contract.** `card-detail/spec.md:67` requires snapshot text "rendered strictly as literal text", which needs no sanitizer and forbids rendering markdown as content.
- **Candidate-then-save had no home.** The board's only manual-read contract is `onManualRead(kind, optionId)` plus a `pending` flag; nothing in it shows candidates, yet candidates are product truth.

The amendment resolves all four the same way: **this change is the first backend behind the board, not a surface of its own.** Everything it produces is consumed by UI that already exists, and its Forward notes were written by the siblings themselves:

- `workflow-board-ui/design.md:160` — "the intake change fills `lanes[0].cards` and flips `load-ideas` / `compose` to `available` inside `buildBoardView`. Listener changes replace `not-configured`. Neither requires a component change."
- `card-detail-and-source-health-ui/design.md:183` — "the intake and projection changes populate `detail` and `sourceHealth` with real rows. They MUST build every link through `toSafeLink` and every relative time through `formatRelativeTime(…, generatedAt)`; they MUST NOT write a lane listener line into `timeline`."
- `handoff-flow-dialogs-ui/design.md:184` — its Forward note assigns `compose` to the intake change: "Each connects one optional member and flips its `Availability` to `available`; no flow component changes."

What exists when this change starts: the archived `github-app-and-openspec-discovery` (installations, users, sessions, repositories, the `SqlDriver` interface, migrations `0001`–`0002`, and the GitHub method recorder); and the four applied UI changes, which own the design system and its single overlay implementation, the board view model and its production provider, the detail panel and source health, and the flow dialogs with their `FlowController` seam. Binding cross-change decisions are in `.claude/handoff/repoint-mcp-inboxes-to-board.md` and `.claude/handoff/explore-claude-design-ui-integration.md`; this design implements them and does not reopen them.

Constraints that shape the approach: CLAUDE.md (portable ANSI SQL through one driver interface, migrations as ordered `.sql` files, exact version pins resolved at install, secrets from the environment, zero GitHub writes) and the UI brief's honesty rules (production renders only real installation-scoped data; a lane never claims a listener it does not have).

Behavioral contracts: `specs/idea-intake/spec.md` and `specs/source-provenance/spec.md`.

## Goals / Non-Goals

**Goals:**

- One read-only adapter port for GitHub Issues, GitLab issues, and Jira, plus a local Manual inbox, with the read-only property enforced by an executable recorder rather than by prose.
- Append-only snapshots with one content-hash function, and provenance kept strictly apart from human interpretation.
- One Idea-lane read path shared by the five-minute listener and the on-demand Load ideas, with lane state owned by the listener alone.
- A complete mapping from stored rows into the view models the board, the detail panel, and source health already define — so every value the UI shows is derived once, on the server, and the UI derives nothing.
- Additive integration: four sibling-owned source files gain a call, an optional member, a conditional render, and one optional prop, plus one declared sibling test edit; none is restructured.

**Non-Goals:**

- A second surface of any kind — no intake page, no saved-ideas list, no intake route, no new lane.
- Rendering markdown, or any sanitizer: literal text needs neither.
- Per-user MCP OAuth, a GitHub-to-Jira identity join, or any credential-entry, login, or connection-editing surface.
- Recomputing OpenSpec discovery during save.
- Persisting unsaved candidates, in SQL or in a server cache.
- Webhooks, source writes, PR/MR fetch, workflow projection, and the promotion writer.

## Decisions

### 1. Consume the installation identity; add four intake tables in one migration

Tenancy is the archived change's `installation_id`; the actor is `github_user_id`. Foreign keys target `installations(github_installation_id)` and `users(github_user_id)`. No `workspaces` table, no second repository identity, and `github_repo_id` is not a required column on an Idea — an Idea may exist without a repository (epic Q13).

One migration, `migrations/0003_idea_intake_schema.sql`, creates four tables:

| Table | Role |
| --- | --- |
| `inbox_connectors` | `installation_id`, `source_kind` CHECK (`github-issue` \| `gitlab-issue` \| `jira`), `scope`, `server`, `credential_env`, `status` CHECK (`available` \| `unavailable` \| `misconfigured`), `adapter_identity`, `adapter_version`, `last_attempt_at`, `last_success_at`, `last_error`; PK `(installation_id, source_kind)` |
| `ideas` | `id` TEXT PK (UUID), `installation_id`, `source_kind` CHECK (the four kinds), `external_id` (null for manual), `created_by`, `created_at`, `latest_snapshot_id`, `promotion_snapshot_id`, `interpretation`, `interpretation_updated_at`, `soft_deleted_at`, `soft_deleted_by`; UNIQUE `(installation_id, source_kind, external_id)` |
| `idea_snapshots` | Insert-only: `id` TEXT PK, `idea_id`, denormalized `installation_id`, `payload` TEXT (canonical JSON), `content_hash`, `fetched_at`, `adapter_identity`, `adapter_version`, `permalink` (null only for manual), `created_by` |
| `idea_lane_state` | PK `installation_id`; `last_attempt_at`, `last_success_at`, `consecutive_failures`, `next_attempt_at`, `last_error` |

Every CHECK is written **inside** its `CREATE TABLE`. The precedent is `migrations/0002_discovery_report_status_check.sql`, which had to recreate `discovery_reports` with `CREATE TABLE` / `INSERT … SELECT` / `DROP TABLE` / `ALTER TABLE … RENAME TO` purely because SQLite cannot add a CHECK to an existing table. Adding the constraints up front is free; adding them later costs a rebuild migration.

Timestamps are ISO-8601 `TEXT`. The snapshot payload is `TEXT` holding canonical JSON — never `jsonb`, which does not exist in SQLite and would not be portable. Upserts are UPDATE-first-else-INSERT inside `driver.transaction`: no `ON CONFLICT`, no `RETURNING`, so the same SQL reads correctly against either engine (CLAUDE.md, "Database portability"). Call sites reach the store only through the existing `SqlDriver` interface and the four modules under `src/server/db/`.

Saving an external id that already has an Idea in this installation **appends a snapshot to that Idea**; it never creates a second Idea. If that Idea had been removed, the same save restores it (Decision 13).

**Rejected:** keying Ideas by permalink string or `owner/name` (both are GitHub's mutable display aliases — the archived Decision 4 already settled that identity is numeric and canonical). A required repository column on `ideas`. Candidate rows in `ideas`, which would make "reviewed but not saved" a stored state that something has to clean up. Four migrations, one per table, which would let a partially applied set leave a foreign key dangling.

### 2. The adapter port is read-only by type, and a recorder proves it

```text
InboxAdapter
  listCandidates(connector) -> Candidate[] | AdapterError
  getItem(connector, externalId) -> NormalizedItem | AdapterError
```

Two members, both reads. There is no write member to call, so "never write to a source" is a property of the type rather than a rule each adapter must remember. `normalize-item.ts` maps an adapter result to `NormalizedItem`; optional fields the source does not supply stay `null` rather than being invented. An imported kind with no permalink fails the save — Jumphour does not fabricate a URL to satisfy a column.

**A connector row holds exactly two failure outcomes.** `unavailable` is **every failed read** — the server could not be reached, it errored, or it **rejected the credential**. `misconfigured` is **structural only** and is decided at sync, never by a read: the entry is malformed, the credential variable is unset, or the entry is a duplicate (Decision 9). There is no `unauthorized` status anywhere in this change. The split follows what a reader can do about it: a failed read may succeed next time, so Retry stays available, the listener keeps trying under backoff, and the next successful read returns the connector to `available`; a structural fault cannot be read through at all, so Retry is unavailable until an operator fixes the file or the environment and restarts. Mapping a rejected credential to `misconfigured` — the first draft of this rule — would have let one transient 401 strand a connector until the next restart. A third status word would have to be rendered on every failure surface while offering the reader no different action, and this product deliberately shows no credential surface at all. Storage keeps the two words; every user-facing surface collapses them to source health's `unreachable` plus one reason sentence (Decision 10).

Manual is not an MCP adapter. Compose writes an Idea plus its first snapshot locally; Load ideas → Manual re-reads the local store.

`src/server/intake/adapters/fixtures.ts` holds recorded adapter payloads for tests only. It sits beside the adapters because tests in several groups share it, but no route, board provider, or component may import it, and a containment test fails naming any file that does — the same honesty rule the preview fixtures live under, enforced for a second directory.

`src/server/intake/adapter-method-recorder.ts` mirrors `src/server/github/github-method-recorder.ts`, which wraps the one GitHub request seam and records every attempted method and path so a test can drive real code paths and assert what they actually asked for. The intake recorder does the same for the MCP transport: it records every tool or method name an adapter invokes, and a test drives the listing, get, refresh, and listener paths and asserts that the recorded set contains no mutating call. Like its GitHub counterpart it **ships as production source, not as a test helper** — for the reason that file states in its own header: it is the executable form of a repository-wide constraint, so a later change that begins writing must delete or narrow it deliberately rather than quietly stop importing a test-only module. CLAUDE.md's zero-write rule is written about GitHub; this change extends it to GitLab and Jira by construction.

**Rejected:** reading GitHub Issues through the installation token — the App deliberately does not request the Issues permission, and doing so would make the GitHub inbox a different mechanism from the other two. A single `read(kind, args)` method with a string discriminator, which would put the write surface back inside a parameter. Asserting the read-only property only in prose, which is what the original design did.

### 3. Canonical values — normalize once, enumerate every reader

Each value below has exactly one computation site. Every reader imports it; nothing re-derives it, and nothing in the UI derives any of it.

| Value | Canonical form | Computed where | Readers (all must consume the canonical form) | Owner |
| --- | --- | --- | --- | --- |
| Imported Idea identity | `(installation_id, source_kind, external_id)`, unique where `external_id` is not null | `save-candidate.ts` at save; enforced by the UNIQUE constraint | duplicate detection, refresh, the candidate sheet's "Already saved" status, listener reads | this change |
| Manual Idea identity | `ideas.id` — a UUID string | `compose-manual-idea.ts` | the same readers as above. For both kinds, `ideas.id` is `CardViewModel.id`, the `?card=` value, the member of the local hide set, and the identifier the compose route returns | this change |
| Snapshot identity | `idea_snapshots.id`, insert-only and never updated | snapshot insert | `ideas.latest_snapshot_id`, `ideas.promotion_snapshot_id`, timeline entries, retention, refresh | this change |
| Content hash | SHA-256 over canonical sorted-key JSON of the normalized payload — imported: kind, `external_id`, `display_key`, permalink, title, body, state, labels, author, source timestamps; manual: kind, title, description, supporting links | `content-hash.ts`, once at insert | the provenance section displays the **stored** hash; no reader recomputes it | this change |
| Source name in sentences | `sourceShortName(kind)` → `GitHub` \| `GitLab` \| `Jira` \| `Manual` — the SHORT name, distinct from the board's badge/menu LABEL `sourcePresentation(kind).label` (`GitHub`, `GitLab`, `Jira · MCP`, `Manual`) | `src/lib/intake/source-names.ts` (framework-free) | every sentence this change authors: card evidence ("Captured from Jira PAY-184"), the failed-read reason ("Jira could not be read."), the refresh reason ("No Jira inbox is configured for this installation."), `banner.retryLabel` ("Retry Jira source"), and the GitHub / GitLab banner title and body. The LABEL is used only where a badge or menu label shows: `ManualRead.options[].label` and the sheet title ("Load ideas from Jira · MCP"). The Jira banner title stays the sibling's exact "Jira via MCP is unavailable" | this change; the label is `workflow-board-ui`'s |
| Display key | adapter-normalized `display_key` on the snapshot (`#814`, `PAY-184`); `null` for manual or when the adapter gives none | `normalize-item.ts` | `CardViewModel.source.key`, the evidence line, each candidate row's accessible name, each Save control's accessible name | this change |
| Source kind | `github-issue` \| `gitlab-issue` \| `jira` \| `manual` — an **identity** mapping onto the board's `SourceKind`, which is the same vocabulary | stored on `ideas` and `inbox_connectors` | `CardViewModel.source.kind`, Load ideas option ids, the source filter, connector rows. Label and badge variant come **only** from `sourcePresentation()`; nothing here builds a label | vocabulary shared with `workflow-board-ui`, which owns `sourcePresentation()` |
| Connector status → `SourceConnectionStatus` | the top-down table in Decision 10 | `src/server/board/source-health.ts` | source-health rows, the source status banner, the Settings "Source connections" list, each row's retry availability | this change; the target type is `card-detail-and-source-health-ui`'s |
| Connector failure vocabulary | stored: exactly two outcomes, `unavailable` \| `misconfigured`, and no third one (Decision 2). Displayed: source health's word `unreachable` plus one reason sentence — "<Source> could not be read." (`<Source>` is `sourceShortName(kind)`) for `unavailable`, "This connection is misconfigured. An operator must fix its configuration." for `misconfigured` | the stored word in the adapter error mapping (`src/server/intake/inbox-adapter.ts`); the displayed pair in `src/server/board/source-health.ts` | the candidate sheet's `unreadable` state, source-health rows, the source status banner, each row's retry availability | this change |
| Idea-lane listener state | the top-down table in Decision 7 → `ListenerState` | `src/server/board/idea-lane.ts` | the Idea lane header, the source-health lane listeners list, the detail timeline's lane line — all three read it through `formatListenerState()`, never as raw columns | this change; the type and the formatter are `workflow-board-ui`'s |
| Capture time | one instant — the snapshot's `fetched_at` | snapshot insert | `CardViewModel.freshness.at` and `detail.intake.snapshot.capturedAt` are the same value, so the card age and the provenance line cannot disagree; also the timeline entry and the source-health row | this change |
| Safe links | `toSafeLink(href, label)` → `SafeLink \| null` | `src/lib/board/safe-href.ts` | **every** link this change produces: the detail permalink, each timeline entry's link, each manual supporting link, and the card's "Open source" href. A rejected href is dropped from the view model and stays in storage | `card-detail-and-source-health-ui` |
| Relative time | `formatRelativeTime(iso, generatedAt)` | `src/lib/time/format-relative-time.ts` | card freshness, the provenance snapshot line, every timeline `when` this change authors, the candidate sheet's "Already saved" age, source-health row times | `workflow-board-ui` |
| Compose validation | `validateCompose()` / `isBlank()` / `parseSupportingLinks()` | `src/lib/flows/compose-form.ts` | the compose dialog in the browser **and** the persist route on the server — the same functions on both sides, so the two cannot drift | `handoff-flow-dialogs-ui` |
| Tenancy | `installation_id` from the session | `src/server/intake/request-context.ts` | every repository read and write (each carries `WHERE installation_id = ?` in its own SQL), every route, the board provider, and the switcher behavior that discards an open candidate sheet | key owned by `github-app-installation`; the helper is this change's |
| Intake availability | `Availability` — `available` whenever the session has a current installation; otherwise `unavailable` with reason "Select a GitHub App installation to load or compose ideas." | `src/server/board/idea-lane.ts` | the Idea lane's `manualRead.availability`, `BoardViewModel.compose`, and every compose entry point through `flowEntryState()` | this change; the type is `workflow-board-ui`'s |

Two rules follow from the table. First, imported text never flows into a connector selection, an installation switch, a repository id, or a filter — it is display data and nothing else. Second, nothing display-side feeds the hash: the hash covers the adapter-normalized payload as retrieved, so no rendering decision can change an Idea's identity.

**Rejected:** a `sanitizeForDisplay()` boundary in this table, removed by Decision 4. Recomputing the content hash at render to "verify" it, which would turn a storage fact into a render-time computation with two possible answers. A second relative-time formatter for the candidate sheet, which would let "14 min ago" on a candidate disagree with "14 min ago" on the card it becomes.

### 4. Untrusted content is literal text; there is no sanitizer

The rule, end to end: store the adapter-normalized payload **as retrieved**; hash it once at insert; render it on every surface — card, detail snapshot block, candidate row, interpretation note — strictly as literal text. Markup and markdown appear as their literal characters. Nothing imported is ever rendered as HTML, and an imported address becomes a link only through `toSafeLink`'s http/https allow-list; anything it rejects is plain text.

This is not a weakening of the original design, it is the removal of a contradiction. `card-detail/spec.md:67` already requires snapshot content "rendered strictly as literal text", and its failure scenario asserts that `<script>alert(1)</script>` is displayed "as literal characters, including the angle brackets". React text nodes do that with no library. A sanitizer would be a new runtime dependency solving a problem the render path has already solved, and "markdown is displayed as content" would reintroduce the HTML boundary the detail panel exists without.

One consequence is load-bearing: **the client never supplies snapshot content.** Save sends only `{ inbox, externalId }`, and the server re-reads the item through `getItem` before hashing and storing it. A candidate rendered in the browser is display state; what is stored is what the server read. Otherwise a modified request body would be stored and hashed as if a source had said it.

**Rejected:** a markdown sanitizer (a dependency, a new pin, and a boundary that must be right everywhere). Sanitizing on write (it would change the hash of what was actually fetched, so hostile markup could alter an Idea's identity by being stripped). Trusting the candidate payload the client already holds and saving a round trip — the saving is one read, and the cost is the entire integrity of the store.

### 5. The board is the surface: provider mapping and one additive detail member

`src/server/board/idea-lane.ts` turns Ideas into cards; `src/server/board/board-view.ts` (owned by `workflow-board-ui`) calls it. The mapping is total, and the provider computes all of it:

| Stored value | View-model field |
|---|---|
| `ideas.id` (UUID string) | `CardViewModel.id` — also the `?card=` value, the local-hide set member, and the identifier the compose dialog reports |
| — | `laneId: "idea"` for every Idea (no promotion exists yet) |
| `ideas.source_kind` | `source.kind` — IDENTITY mapping; the board's `SourceKind` is the same vocabulary. Badge / label only through `sourcePresentation()` |
| latest snapshot `display_key` | `source.key` (`#814`, `PAY-184`); `null` for manual or when the adapter gives none |
| latest snapshot `title` | `title` (literal text) |
| — | `changeName: null`, `repository: null`, `owner: null` (Jumphour never assigns; a source author is not an owner), `relevance: null`, `agentNote: null` |
| latest snapshot `fetched_at` / manual `created_at` | `freshness: {kind:"snapshot", at}` / `{kind:"composed", at}` |
| — | `evidence`: imported `{tone:"neutral", text:"Captured from <GitHub\|GitLab\|Jira> <key>"}` (omit the key when null); manual `{tone:"neutral", text:"Created in Jumphour"}` (both strings are the board spec's own, `workflow-board/spec.md:186,199`) |
| snapshot source timestamps / manual `created_at` | `footer`: imported `"Opened Sep 9 · updated Sep 14"`, built from the snapshot's source created and updated timestamps, omitting whichever the source did not supply, and `""` when it supplied neither (never invented); manual `"Composed Sep 13"`. Authored by the provider as short `en-US` month + day in UTC, so server and client render one string |
| host of the permalink, only when `toSafeLink` accepts it | `externalHostLabel` (`"github.com"`); `null` for manual |
| `ideas.soft_deleted_at IS NOT NULL` | card omitted for EVERY viewer (server filter — not the local Hide set) |

The `footer` strings follow the prototype's Idea-lane fixtures (`Jumphour Board.dc.html` lines 662–665: `'Opened Sep 9 · updated Sep 14'`, `'Composed Sep 13'`). `workflow-board/spec.md:183` fixes no literal footer string, and the view model keeps `footer: string` and `externalHostLabel: string | null` as separate members, so the footer never stands in for the host label. It is deliberately **not** card-detail's read-only note copy, which already has one owner.

Detail follows the same rule. `CardDetailViewModel` gets `permalink = toSafeLink(snapshot.permalink, …)` (`null` for manual or when the check rejects it); `provenance` = `"manual"` for a manual Idea and `"imported"` for every other kind; `snapshot.description` = the stored body **as retrieved**; `snapshot.acceptance: null`; `snapshot.labels`; `project: null`; `linkedArtifacts: []`; and a `timeline` of one provider-authored entry per snapshot, newest first, capped at 10 ("Snapshot captured" / "Snapshot refreshed", each with `tone: "neutral"` — a capture is a fact, not a warning or a success — `when` from `formatRelativeTime(fetched_at, generatedAt)`, `link` from `toSafeLink`) — and **never** a lane-listener line, because the panel composes that itself from the same formatter the lane header uses (`card-detail-and-source-health-ui/design.md:183`, its Decision 6). Actions are `{ startSpec: unavailable("Attended launches are not enabled for this installation yet."), startShip: null, promote: unavailable("Promotion is not enabled for this installation yet.") }`; both reason strings are the sibling specs' own.

The fields with no slot in that contract get exactly **one additive optional member** — a type-only edit that changes no sibling spec text:

```ts
// src/lib/intake/idea-detail-view-model.ts  (this change)
export interface IdeaIntakeDetailViewModel {
  ideaId: string;
  snapshot: { id: string; contentHash: string; capturedAt: string; adapter: string | null; count: number };
  interpretation: string | null;        // human-authored; rendered as literal text, separate from the snapshot block
  supportingLinks: SafeLink[];          // manual ideas only; each built through toSafeLink, rejects dropped from the VIEW (they stay stored)
  refresh: Availability | null;         // null for manual ideas
  editInterpretation: Availability;
  remove: Availability;
}
// src/lib/board/card-detail-view-model.ts (owned by card-detail-and-source-health-ui) gains exactly:  intake?: IdeaIntakeDetailViewModel
```

`src/app/components/intake/idea-provenance-section.tsx` renders it as a "Snapshot provenance" section inside the existing detail panel, shown only when `detail.intake` is present. `contentHash` is the stored hash. `capturedAt` is the same instant as `CardViewModel.freshness.at` — one source, two readers.

**Rejected:** a separate intake page or saved-ideas list (the blocker this amendment exists to remove: two surfaces for one set of Ideas, with two empty states, two filters, and two answers to "where are my ideas"). Widening `CardDetailViewModel`'s existing members to carry intake fields, which would edit a sibling's spec text. A second fetch keyed by card id, which the detail panel's own Decision 1 rejected for the reasons that still hold: a second `generatedAt`, a second scoping check, and a loading state inside a panel that currently has none.

### 6. Load ideas reads one inbox per invocation and opens a candidate review sheet

The board's contract is that "choosing an option requests exactly that read" → `onManualRead("load-ideas", optionId)`. So `ManualRead.options` is one option per configured connector (`id` = the `source_kind` string, `viaMcp: true`) plus, always, `manual` (`viaMcp: false`). A connector whose status is `unavailable` or `misconfigured` is **still listed** — the read then reports it unreadable. Inventing candidates for a broken connector, or hiding the option so the failure is invisible, are both worse than saying so. While a read is in flight the board's existing `pending` prop is true. Choosing `manual` re-reads the local store and opens no sheet: manual Ideas are saved at compose time, so a manual read creates nothing.

Each option's remaining fields are provider-computed, never derived in the menu:

| Option `id` | `badge` | `label` | `viaMcp` |
| --- | --- | --- | --- |
| `github-issue` | `"github"` | `sourcePresentation("github-issue").label` | `true` |
| `gitlab-issue` | `"gitlab"` | `sourcePresentation("gitlab-issue").label` | `true` |
| `jira` | `"jira"` | `sourcePresentation("jira").label` | `true` |
| `manual` | `"manual"` | `sourcePresentation("manual").label` | `false` |

The order is fixed — `github-issue`, `gitlab-issue`, `jira`, `manual` — so the menu does not reorder itself when a connector's status changes, and `manual` is always last because it is always present. No label string is written here: `sourcePresentation()` is `workflow-board-ui`'s and owns every source label and badge variant in the product.

An external option opens the **candidate review sheet**, built on `design-system`'s `Sheet` so there is exactly one overlay implementation in the product. Its states:

- `loading` → `ready` (N candidates) | `empty` (zero) | `unreadable` (the connector is `unavailable` or `misconfigured` — the only two failure outcomes there are, Decision 2).

Binding copy: title "Load ideas from `<source label>`"; subline "Read just now. Nothing is saved until you choose Save. Never writes back."; row action "Save snapshot". A candidate that is already an Idea shows the status text "Already saved" with its snapshot age and the action "Save new snapshot", which appends a snapshot to the **same** Idea. Only an Idea that has not been removed counts: a removed one is an ordinary candidate, and saving it restores the Idea (Decision 13). A saved row **stays in the list** and changes to the text status "Saved", so focus never loses its row; a failed save shows an inline error on that row only. Closing the sheet discards every unsaved candidate: candidates live only in the response and in client state. After any save the board data is re-requested so the new card appears in the Idea lane.

**The `unreadable` state** shows the word `unreachable`, one reason sentence, and "Your saved ideas are unchanged." The reason sentence is the connector's (Decision 2): `unavailable` → "<Source> could not be read." (`<Source>` is `sourceShortName(kind)`); `misconfigured` → "This connection is misconfigured. An operator must fix its configuration." It offers **no** "View connection details" action, and never a credential, login, or OAuth surface. The reason it offers no such action is structural: a modal sheet must not open a side panel, which would either stack a panel under a modal or dismiss the modal to reveal it. It does not need to — when the sheet closes, the board data is re-requested, so the board's own source status banner and the source health view already carry the detail, with their own retry and their own copy.

**One save per row.** A row whose save is in flight accepts no second save: its control is disabled for the duration and the reducer ignores a second activation for a row already in `saving`. A double activation therefore saves exactly once — without that rule, a double click would append two snapshots a second apart to the same Idea and report two different outcomes into one row.

**At most 50 candidates**, most recently updated first. When the source has more, the sheet states "Showing the 50 most recently updated items." A cap is a product decision rather than a performance one: a review surface that lists 400 rows is not reviewed, and the honest statement of what was truncated is cheaper than pagination inside a modal the reader is meant to leave quickly. `read-inbox.ts` asks the adapter for **51** items, returns the first 50, and sets `truncated` when a 51st came back — so "more than 50" is detected without requiring any source to report a total.

**Overlay stacking.** The sheet and the Remove confirmation are modal flow surfaces on `design-system`'s single overlay stack (`design-system-and-app-shell/design.md:74`) — exactly as `handoff-flow-dialogs-ui`'s launch sheet and promote dialog open over the detail panel. The topmost surface traps focus, Escape resolves innermost-first (so a confirmation over the sheet closes the confirmation and leaves the sheet), and closing restores focus to the invoker. The candidate sheet is **not** a "side panel" under source health's one-side-panel rule (`source-health/spec.md:124`): it is a modal flow surface, it never opens card detail or source health, and it leaves whichever panel was open exactly as it found it.

`src/lib/intake/candidate-review-state.ts` is a pure reducer over `loading | ready | empty | unreadable` plus a per-row `idle | saving | saved | failed`. It imports no React and nothing from `src/server/`, so every state in the spec is constructible in a test without a timer or a fetch, and the sheet component stays a rendering of its argument.

Accessibility splits in two. This change **states**: list semantics for the candidate list; each row's accessible name is its key plus its title; each Save control's accessible name includes that row's key and title (so a screen-reader user hears which of eight "Save snapshot" buttons they are on); the result count, each per-row saved or failed outcome, and the unreadable state are announced through a status region; and every state is conveyed in text, not by tint alone. Everything else — focus trap, Escape, focus restoration, outside click, scroll lock, modal labelling, the coarse-pointer target floor, reduced motion — is **inherited from `design-system`** and is cited here rather than restated, because restating it would create a second specification of behavior that already has one.

**Rejected:** a multi-select "read all inboxes" invocation, which the board's one-option-one-read contract does not express and which would make a partial failure ambiguous in the one place a user is deciding what to keep. A short-lived server cache keyed by `(installation, user, load_id)` — the original Decision 5 — which is a second store of unsaved candidates with its own expiry, for data a reader is looking at right now. Removing a saved row from the list, which moves focus out from under the user mid-task. Opening a candidate sheet for Manual, which would offer to "save" Ideas that are already saved. A "View connection details" action inside the modal sheet: it would have a modal open a side panel, and the detail it promises is already one sheet-close away on the banner and in source health. An unbounded candidate list, which makes the empty-handed reader scroll a modal to find out there was nothing new.

### 7. The listener owns the Idea lane's state, and never saves

`IDEA_LISTENER_INTERVAL_MINUTES = 5`. Lane state is evaluated top-down:

| Condition | `ListenerState` | Board text (the board's formatter — quote, never re-word) |
|---|---|---|
| listener host disabled, OR the installation has zero configured connectors | `not-configured` | "Listener not configured" |
| listener enabled, connectors exist, but no lane-state row (defensive) | `never-heard{intervalMinutes: 5}` | "Listening every 5 min" + "Not heard yet" |
| `consecutive_failures > 0` | `delayed{lastSuccessAt, retrying:true, intervalMinutes: 5}` | delayed/retrying + "Last successful listen 14 min ago" |
| `now − next_attempt_at > 5 min` (host is not ticking) | `delayed{lastSuccessAt, retrying:false, intervalMinutes: 5}` | delayed wording |
| `last_success_at IS NULL` | `never-heard{intervalMinutes: 5}` | "Listening every 5 min" + "Not heard yet" |
| otherwise | `healthy{lastHeardAt:last_success_at, intervalMinutes: 5}` | "Last heard 2 min ago" |

The table is **total**: every combination of host flag, connector count, and lane-state row reaches exactly one row. Every variant except `not-configured` carries `intervalMinutes: 5`, so a lane that claims to listen always states how often. The overdue comparison is strict: exactly 5 minutes past `next_attempt_at` is **not** delayed; 5 minutes and 1 second is.

**Who creates the lane-state row.** `syncInboxConnectors()` does, at start (Decision 9): every installation that has at least one connector row and no `idea_lane_state` row gets one inserted with `next_attempt_at = now`, `consecutive_failures = 0`, and `last_attempt_at` / `last_success_at` / `last_error` null; every lane-state row whose installation has zero connectors is deleted. Without that reconciliation nothing ever wrote the first row, and both the tick selector (`next_attempt_at <= now`) and the conditional claim (`UPDATE … WHERE next_attempt_at = ?`) key on a row that did not exist — so the listener would have matched zero rows forever while the lane read `never-heard`. The defensive row above exists because state must still be readable in the window between a connector being added and the next sync.

Only the Idea lane is affected; the other three lanes keep `not-configured`, because nothing listens for them.

A tick reads **every** configured connector of the installation through the same read path Load ideas uses. The tick succeeds only if every read succeeded. On a partial failure each connector records its own outcome, but the lane records a failure: `consecutive_failures` increments, the backoff runs 1 → 2 → 4 → 8 minutes capped at 10, and `last_success_at` does not advance. That is the honest reading of a lane header that speaks for the whole lane.

Lane state is owned by the listener **alone**. Load ideas and Retry update only the chosen connector's read health; neither touches `idea_lane_state`. A single-inbox read must not make the lane look healthy while another inbox is failing — which is exactly what the original design's "Load ideas success updates `last_success_at`" rule would have done. `last_error` has no place on the lane header either; it feeds source health's `detail`.

The listener **never auto-saves**. It refreshes lane state and nothing else; Ideas appear only on an explicit Save or Compose. This is now a spec scenario rather than a design note, because auto-creation is the single most tempting shortcut here and would silently fill the Idea lane with items nobody chose.

**Rejected:** four independent lane pollers in this change (three lanes have no backend to poll). Webhooks, which the epic forbids as a freshness mechanism. Advancing `last_success_at` on a manual read. Treating a partial tick as a success, which would report a healthy lane while an inbox has been dark for hours.

### 8. Listener host: one in-process timer in `src/instrumentation.ts`, off by default

`register()` in `src/instrumentation.ts` is the single entry point, and it runs these steps **in this order**:

1. Return unless `process.env.NEXT_RUNTIME === "nodejs"`. The Edge runtime has no timer, no file system, and no driver.
2. Return when `process.env.NEXT_PHASE === "phase-production-build"`. A build must never open the database, read the connector file, or start a timer that outlives it.
3. `runMigrations(getDriver(), …)` — the same idempotent call the health route makes. It comes **first** because `src/app/api/health/route.ts` is today's only `runMigrations` call site, so a cold boot that has not yet served `/api/health` has no tables at all, and every step below would be writing into an empty file. If it fails, log one line and **return** — start no timer and set no guard — so a later registration retries instead of leaving the process half-initialized.
4. `syncInboxConnectors()` — mirror the connector file into `inbox_connectors` and reconcile `idea_lane_state` (Decision 9). Idempotent, so it is safe on every registration.
5. Return if `globalThis.__jumphourIntakeHost` is already set; otherwise set it. The guard's only job is to prevent a second set of **timers** under dev HMR or any repeated registration. It is set here, after the idempotent steps, and never before a step that can fail.
6. Schedule the hourly retention sweep.
7. **Only** when `ideaListenerEnabled`, start the 30-second listener timer.

Each step is wrapped: a failure logs exactly one line — never a secret, never file contents — and **never throws out of `register()`**, because a boot that cannot mirror connectors must still serve the board and its honest empty state.

`JUMPHOUR_IDEA_LISTENER=1` gates step 7 alone — default off everywhere, exactly like `JUMPHOUR_UI_PREVIEW`. With the host off the lane reports `not-configured`, which is true, and steps 3 through 6 still run, because Load ideas, Retry, Remove, and retention all work without a listener.

The timer wakes every 30 seconds and calls a pure, injectable `runIdeaLaneTick({ driver, adapters, now })` for each installation whose `next_attempt_at <= now`, claiming the row with a conditional `UPDATE … WHERE next_attempt_at = ?`. The claim is portable ANSI and remains safe if Postgres later runs several instances: the losing instance updates zero rows and does nothing.

**Why in-process:** `better-sqlite3` is single-process, so a second worker process would be a second writer against the same file. Injecting the tick keeps the schedule out of the logic: every listener behavior is testable by calling the function with a fixed `now`.

**Rejected:** a separate Node worker (second SQLite writer, and a second deploy unit). An external cron hitting a route (a new shared secret, a new public surface, and a deploy-time prerequisite before the lane can ever be healthy). A scheduler dependency, for one timer. Syncing connectors before running migrations, which writes into tables that a cold boot has never created. Letting an unparseable connector file wipe the connector rows (Decision 9): a typo in an operator's file would silently disable every inbox.

### 9. Connectors are operator configuration: a file plus environment variables, no UI

`JUMPHOUR_INBOX_CONNECTORS_FILE` names a JSON file outside git listing `{ installationId, sourceKind, scope, server, credentialEnv }`. `credentialEnv` is the **name** of an environment variable holding the secret — the secret itself is never in SQL, never in the file, and never in git, which is what CLAUDE.md means by "secrets come from the environment". At server start `syncInboxConnectors()` mirrors the file into `inbox_connectors` with UPDATE-first-else-INSERT, deleting rows the file no longer lists (`ideas` do not reference connectors, so a removed connector strands nothing). In the same pass it **reconciles `idea_lane_state`**: every installation that has at least one connector row and no lane-state row gets one inserted with `next_attempt_at = now`, `consecutive_failures = 0`, and `last_attempt_at` / `last_success_at` / `last_error` null; every lane-state row whose installation has zero connectors is deleted. That is the only writer of the first lane-state row, and without it the listener's selector and conditional claim would match nothing forever (Decision 7).

One connector per `(installation_id, source_kind)`. Three malformed-input rules, all of them chosen so a file mistake degrades visibly rather than silently:

- A file that is **not valid JSON**, or whose top level is not an array, changes **nothing** in SQL and logs one error line naming the path. A typo must not wipe an installation's connectors.
- **Two entries for the same `(installationId, sourceKind)`**: the pair is stored once, as `misconfigured`, with `last_error` "Duplicate connector entry." Picking a winner would make the effective configuration depend on file order.
- A row whose `credentialEnv` is unset, or whose entry is malformed, is stored as `misconfigured` rather than dropped — a misconfiguration the operator can see beats a connector that silently does not exist.

`misconfigured` is decided **here, at sync, and nowhere else**: a read never sets it. A credential the source rejects at read time is an `unavailable` read like any other failed read (Decision 2), so it recovers by itself when the source accepts the credential again. With neither the variable nor the file present, an installation has zero connectors: Manual-only intake, lane `not-configured`.

This replaces the original "encrypted credential reference" on `inbox_connectors`. An encrypted column needs a key, key rotation, and a decryption path, all to protect a value that the process must hold in cleartext to use; an environment variable name is a pointer with none of that machinery.

**Rejected:** a connection-editing UI (the design prompt excludes it, and every failure surface in this change is explicitly forbidden from offering credential entry). Storing the secret encrypted in SQL (above). Per-user credentials, which is epic Q12 and deferred.

### 10. Source health is derived from connector rows and lane state

One `SourceConnectionViewModel` per `inbox_connectors` row, built in `src/server/board/source-health.ts`. Manual is never a row: the badge type admits only `github | gitlab | jira`. `badge` and `viaMcp` come from `source_kind`, `scope` from the connector's configured scope label, and `lastSuccessAt` from that connector's own `last_success_at` — not the lane's. Status is evaluated top-down:

| Condition | Status | `retry` |
|---|---|---|
| connector `unavailable` | `unreachable` | `available` |
| connector `misconfigured` | `unreachable`, `detail` says an operator must fix the connection's configuration | `unavailable` — "This connection is misconfigured. An operator must fix its configuration." |
| `available` and the lane is `delayed` | `delayed` | `available` |
| `available` and `last_success_at` null or older than `STALE_AFTER_MINUTES = 15` | `stale` | `available` |
| otherwise | `healthy` | `null` |

`STALE_AFTER_MINUTES = 15` is three listener intervals and is **workspace-wide**, which settles the deferred question at `card-detail-and-source-health-ui/design.md:188` ("whether the staleness threshold … is per source or workspace-wide") in the change that first produces real rows, as that question asked. `line` and `detail` are provider-authored, use reading vocabulary only, and never say "sync":

| Case | `line` | `detail` |
|---|---|---|
| healthy, listener running | "Reading every 5 min" | "Read-only. Jumphour never writes to this source." |
| healthy, listener off | "Read on demand" | "Read-only. Jumphour never writes to this source." |
| stale, listener running | "No recent read" | "The last successful read is more than 15 minutes old." |
| stale, listener off | "No recent read" | "No listener is running. This inbox is read only when you choose Load ideas." |
| stale because never read, listener running | "Not read yet" | "No successful read yet. The listener reads this inbox every 5 min." |
| stale because never read, listener off | "Not read yet" | "No listener is running. This inbox is read only when you choose Load ideas." |
| delayed | "Listener delayed" | "The Idea lane listener is retrying. This inbox was reachable at its last read." |
| unreachable (unavailable) | "Could not be read" | "The last read failed. Your saved ideas are unchanged." |
| unreachable (misconfigured) | "Misconfigured" | "An operator must fix this connection's configuration." |

With the listener host disabled an `available` connector ages into `stale`, and the table's listener-off rows are why the row and the lane's "Listener not configured" read as one cause rather than two complaints. A connector that has never been read passes `lastSuccessAt: null`, and the sibling panel renders its own "no successful snapshot yet" phrase from that null — this change invents no last-success time and no "0 minutes ago". `retry` is `available` for `stale`, `delayed`, and `unreachable` caused by `unavailable`; it is `unavailable` with the misconfigured reason for `unreachable` caused by `misconfigured`, and `null` for `healthy`. Retry is an immediate read of that one inbox: it updates that connector's read health, saves nothing, and shows no candidates.

`banner` is the first `unreachable` connector in the order github, gitlab, jira, and `null` when there is none. Its `sourceBadge` comes from the connector's kind and its `retryLabel` is "Retry <GitHub|GitLab|Jira> source". A Jira banner uses the source-health spec's exact copy (`source-health/spec.md:66`). GitHub and GitLab use the parallel construction: title "<Source> is unavailable", body "We couldn't refresh <Source> snapshots for <scope>. Your last captured <Source> ideas are still shown.", hint "Check the MCP connection or try again." A failing connector that has never succeeded takes the body "No successful snapshot has been captured for <scope> yet." instead, because the standard body claims previously captured cards that do not exist. `source-health/spec.md:66` also requires every failure banner to name the time of the source's last successful snapshot; the sibling's banner component composes that itself with `formatRelativeTime` from the matching `sources[]` row (`card-detail-and-source-health-ui/design.md:164`), so this provider's duty is only that the failing connector's row carries its own `lastSuccessAt` (or `null`) — it writes no time into `banner.body`. No surface here offers credential entry, login, OAuth, or connection editing.

**Rejected:** a Manual row in the health list (the badge vocabulary has no Manual member, and a local store has no connection to be healthy). Deriving a connector's last success from the lane's (a healthy GitHub connector would inherit a failing Jira connector's silence). A per-source threshold, which would need per-source configuration to express something no operator has asked to vary.

### 11. Compose is the existing dialog plus a persist route

There is no second form. `src/app/page.tsx` supplies `FlowController.compose` through the intake client wrapper, and `buildBoardView` flips `BoardViewModel.compose` to available whenever the session has a current installation (Decision 3's availability row). The server validates with the **same pure functions** the dialog uses — `validateCompose()`, `isBlank()`, `parseSupportingLinks()` from `src/lib/flows/compose-form.ts` — so the two sides cannot drift: title and description are blank-checked over all Unicode whitespace and stored trimmed; supporting links are split on line breaks and commas, empty entries discarded, order and duplicates preserved, http and https only. A request containing any other scheme is **rejected, naming the offending entries** — never silently dropped and never rewritten, because a user who pasted a `javascript:` line should be told, not quietly edited. `ComposeValues.problem` is stored as the Idea's `description`. Success returns `{ ideaId }`; the board re-requests its data and selects that card. A failure returns an error the dialog shows without clearing the form.

**Selecting the composed card needs one more additive sibling prop.** `BoardScreen` sets its selected id **only at initialization**, from the `card` search parameter, and writes it back with `router.replace` (`workflow-board-ui/design.md:105`). It initializes selection; it does not track an external value, so nothing this change writes from outside moves the selection after mount. So `src/app/components/board/board-screen.tsx` (owned by `workflow-board-ui`) gains exactly one optional prop:

```ts
revealCardId?: string | null
```

Its semantics: when it holds an id that is present in `view`, the screen selects that card exactly as a click would — writing `?card=` and switching the small-screen lane to that card's lane — and it does so **once per distinct value**, so re-renders do not fight a viewer who has since selected something else. Absent, `null`, or an id not in `view` changes nothing, which keeps the sibling's existing rule that an unknown id selects nothing silently. `IntakeBoard` sets it to the `ideaId` compose returned, after `router.refresh()` has brought the new card into `view`.

**Rejected:** a server-side re-implementation of the validation rules (two implementations of "blank" is one silent divergence away from a stored empty title). Dropping rejected links quietly. A second compose surface for intake, which is the same two-surfaces mistake in miniature. Remounting `BoardScreen` with a changing `key` to force it to re-initialize from `?card=` — it would discard the viewer's filters and search along with the selection, which is a visible loss for a value the prop carries for free. Dropping selection entirely and letting the reader find the new card — on a small screen the board shows one lane, and the composed card may well be in a lane that is not the one showing, so the submit would appear to have done nothing.

### 12. Refresh, Remove and interpretation live in the provenance section — and Remove is not Hide

`card-detail/spec.md:207` closes the overflow menu at Copy link, Open source, and Hide from board, and requires that it offer nothing destructive. So the three intake actions live in the "Snapshot provenance" section instead, where their consequences can be stated in full:

- **Refresh snapshot** — "Reads the source now and stores a new snapshot. Earlier snapshots are kept." Never "sync": nothing is reconciled and nothing is pushed. Not offered for manual Ideas (`refresh: null`). When the operator has removed the connector for the Idea's source kind, the Idea survives but has nothing to read through, so Refresh is `unavailable` with the reason "No `<GitHub|GitLab|Jira>` inbox is configured for this installation."
- **Remove idea** — the server-side soft delete, confirmed through `design-system`'s `Dialog`: "Removes this idea from Jumphour for everyone in `<account login>`. The source is not changed." That confirmation is a modal flow surface on the same single overlay stack as the candidate sheet: it opens over the detail panel, traps focus, and Escape resolves it innermost-first, closing the confirmation and leaving the panel (Decision 6).
- **Interpretation** — an inline edit using `design-system`'s `TextArea`. It is stored on the Idea, never inside a snapshot, and stays outside the content hash, so a human note can never change what a source is recorded as having said. It renders as literal text, which settles the old open question about markdown in notes: no.

**The section emits intents; it never fetches.** `card-detail/spec.md:177` requires that the detail view "MUST NOT itself change any card, lane, count, source, or stored record" — so Refresh, Remove, and Save interpretation hand their intent to the host, and `IntakeBoard` performs every request and calls `router.refresh()` afterwards. Each control's enabled state is `flowEntryState(availability, handler)` from `src/lib/flows/flow-controller.ts`, the canonical availability-plus-handler gate, with the handlers read from the intake actions context. An absent handler therefore renders the control disabled with its reason visible, which is how a half-wired surface fails closed instead of opening a confirmation whose confirm goes nowhere. This also keeps the provenance section usable in the preview, where it is rendered with no handlers at all.

**Remove and Hide are different operations and every artifact says so.** Hide is local to one browser, per installation, reversible from the "N hidden · Show all" affordance, and invisible to everyone else. Remove sets `soft_deleted_at`, and the server then omits the card for **every** viewer in the installation. Conflating them would let a viewer believe a private view tweak had removed an Idea from a colleague's board, or the reverse.

**Rejected:** putting Refresh or Remove in the overflow menu (it would contradict a sibling requirement that is already written, and it hides a destructive action behind a menu whose contract is that it holds none). A hard delete on Remove, which would destroy the provenance this change exists to keep. Storing interpretation inside the snapshot payload.

### 13. Retention without a view clock

Card detail ships inside the board view model, so the server never observes "a view" — there is no request that means "the user looked at this Idea". The original `last_viewed_at` column could therefore only ever have been wrong, and it is dropped.

Retention has exactly two clocks — one per case, never stacked:

- A **superseded** snapshot — one that is no longer its Idea's `latest_snapshot_id` — may be hard-deleted 90 days after its own `fetched_at`.
- **Every** snapshot of a **removed** Idea may be hard-deleted 90 days after `soft_deleted_at`, whatever its capture age.
- Never hard-deleted under either clock: a `promotion_snapshot_id` snapshot, and the latest snapshot of an Idea that has not been removed — deleting that would leave a card with no title.

**The two clocks are independent: whichever applies first decides.** A snapshot may be hard-deleted as soon as *either* clock is satisfied, and removal never extends a superseded snapshot's life — a 200-day-old superseded snapshot of an Idea removed 30 days ago is deletable now, on its own capture clock, not in another 60 days. "Never stacked" means neither clock waits for the other, not that the later one wins.

When a removed Idea has no snapshot left and no promotion reference, its `ideas` row is deleted in the same sweep, so removed rows do not accumulate. Until then the row stays, and that matters: the UNIQUE key forbids a second row for the same source item, so **saving a source item whose Idea was removed restores that Idea** — `soft_deleted_at` is cleared and a new snapshot appended — rather than failing the insert or minting a duplicate. The candidate sheet's "Already saved" status therefore counts only Ideas that have not been removed. **The restore rule applies only while the row exists:** once a removed Idea's last snapshot is gone and its row has been deleted, a later save of the same source item creates a **new** Idea with a new `ideas.id` — and therefore a new `?card=` value and no interpretation — rather than resurrecting the old one. Retention runs hourly from the same host as the listener.

Forward constraint on promotion: the future promote handler sets `promotion_snapshot_id = latest_snapshot_id` at submit time, in one transaction. The promote dialog emits idea, repository, and change name only — it has no snapshot id and must not be given one — so the handler is the single place that decides which snapshot a promotion froze.

**Rejected:** keeping `last_viewed_at` and writing it from a route that does not exist. Retaining every snapshot forever (unbounded growth of full issue bodies, for history nobody reads past the last few). Deleting on the Idea's age rather than the snapshot's, which would drop a fresh snapshot of an old Idea. Stacking the two clocks — capture age **and** removal age — which would keep a removed Idea's newest snapshot for up to 180 days and was the first draft of this rule. Refusing to save a source item whose Idea was removed, which would turn Remove into a permanent per-item block nobody asked for.

### 14. One request context, and seven local-write routes

`src/server/intake/request-context.ts` parses the raw `Cookie` header — the `src/app/api/github/refresh/route.ts` pattern, which exists precisely so handlers stay callable from tests without the Next.js request scope — calls `getSession`, and returns `{ installationId, githubUserId }` or a refusal: 401 with no session, 409 with a session but no current installation. It also refuses a state-changing request whose `Origin` or `Sec-Fetch-Site` says cross-site.

Every repository-module read carries `WHERE installation_id = ?` in its own SQL and has its own cross-installation test; scoping is never left to a caller. A cross-installation or unknown Idea id answers 404 with no body detail, so the two are indistinguishable by construction — the same rule the board applies to `?card=`. Switching installation through the app shell's switcher replaces cards, listener state, Load ideas options, and source health, and discards an open candidate sheet, because none of its rows belong to the new installation.

The seven routes, all of them writes to Jumphour's own store and none of them a write to any source:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/ideas` | POST | save a candidate: `{ inbox, externalId }` → `{ ideaId, snapshotId }` |
| `/api/ideas/load` | POST | read one inbox: `{ inbox }` → candidates, or an unreadable report |
| `/api/ideas/manual` | POST | persist a composed Idea → `{ ideaId }` |
| `/api/ideas/[ideaId]` | DELETE | remove (soft delete) |
| `/api/ideas/[ideaId]/refresh` | POST | capture a new snapshot |
| `/api/ideas/[ideaId]/interpretation` | PUT | set the interpretation note |
| `/api/ideas/connectors/[inbox]/retry` | POST | re-read one inbox's health; saves nothing |

**Rejected:** `cookies()` from `next/headers` in the handlers (it needs the framework request scope, which is what the existing route avoids so its tests can call the handler directly). Per-call scoping decided by the caller. Distinct 403 and 404 answers for foreign versus unknown ids, which is an existence oracle across installations.

### 15. Libraries: the MCP client SDK, and nothing else

One new runtime dependency: the MCP client SDK, with its exact version resolved from the npm registry at install and pinned literally in `package.json` — no `^`, no `~`, no `latest` — with the lockfile committed (CLAUDE.md, "Version pinning"). This design deliberately does not name a version number from memory; the install task reads it from the registry and records it here and in `package.json` in the same commit.

**Not added:** a markdown sanitizer, because Decision 4 removed the need for one; a scheduler, because Decision 8's host is a single timer.

**Rejected:** a markdown sanitizer and a markdown renderer (Decision 4 — literal text needs neither, and each would be a permanent dependency guarding a boundary that no longer exists). A job-scheduler package for one 30-second timer. Writing a version number into this document from memory instead of resolving it at install, which CLAUDE.md forbids outright.

### 16. Preview page `/dev/ui/intake`

`src/app/dev/ui/intake/page.tsx` follows the preview-gallery rules `ui-preview-gallery` already fixes: it calls the guard itself **first** and answers 404 unless `JUMPHOUR_UI_PREVIEW=1`; it carries the persistent "Preview — fixture data" label; and its fixtures live in `src/app/dev/ui/fixtures/intake.ts`, never imported by a production module. Scenarios are selected by query string and cover the candidate sheet's four states, a hostile-content candidate and snapshot, the provenance section for an imported and a manual Idea, the four Idea-lane listener states, and the candidate sheet stacked over an open detail panel — two right-side surfaces, where the sheet is modal with a backdrop so only it is interactive, and the overlap is checked by eye at implementation. The two structure tests created by `design-system-and-app-shell` — one failing any `dev/ui` page that skips the guard, one failing any production import of the fixtures directory — pick this page and this fixture file up without edits; this change confirms that coverage and adds no second copy.

**Rejected:** a production route behind a flag for demonstrating intake (one env var away from fixture data on a real board). Reusing the board preview page, whose scenarios belong to a change this one must not edit.

### File layout

Each tasks.md group owns a disjoint set of these files. The entries marked **EDIT (sibling-owned)** — four source files and one test file — are the only ones this change does not own; every edit to them is **additive**: a call site, an optional member, a conditional render, one optional prop, and replacement assertions for exactly the behavior the sibling's own Forward note assigns here. None rewrites existing behavior. `src/app/page.tsx` and `src/server/env.ts` are app-level rather than sibling-owned, and are edited here as every change edits them.

```
migrations/0003_idea_intake_schema.sql
src/server/db/{inbox-connectors,ideas,idea-snapshots,idea-lane-state}.ts  (+ sibling *.test.ts)
src/server/db/schema-idea-intake.test.ts
src/lib/intake/idea-detail-view-model.ts        # IdeaIntakeDetailViewModel, CandidateViewModel  (framework-free)
src/lib/intake/candidate-review-state.ts        # pure reducer: loading|ready|empty|unreadable + per-row idle|saving|saved|failed
src/lib/intake/source-names.ts                  # sourceShortName(kind): the name used inside sentences (framework-free)
src/server/intake/inbox-adapter.ts              # read-only port, AdapterError, status mapping
src/server/intake/normalize-item.ts             # adapter result -> NormalizedItem (missing optionals stay null)
src/server/intake/content-hash.ts
src/server/intake/adapters/{github-issue,gitlab-issue,jira}.ts   + adapters/fixtures.ts
src/server/intake/adapter-method-recorder.ts    # mirrors src/server/github/github-method-recorder.ts; ships as production source
src/server/intake/connector-config.ts           # parse file + syncInboxConnectors
src/server/intake/request-context.ts
src/server/intake/{read-inbox,save-candidate,compose-manual-idea,refresh-idea,remove-idea,set-interpretation}.ts
src/server/intake/{idea-lane-backoff,idea-lane-tick,retention}.ts
src/server/board/idea-lane.ts                   # Ideas -> cards + detail + ListenerState + ManualRead options
src/server/board/source-health.ts               # connectors + lane state -> SourceHealthViewModel
src/server/board/board-view.ts                  # EDIT (sibling-owned, workflow-board-ui): call the two modules above
src/server/board/board-view.test.ts             # EDIT (sibling-owned test): Idea-lane, compose, sourceHealth expectations only
src/lib/board/card-detail-view-model.ts         # EDIT (sibling-owned, card-detail-and-source-health-ui): add `intake?`
src/app/api/ideas/route.ts                      # POST   save candidate {inbox, externalId} -> {ideaId, snapshotId}
src/app/api/ideas/load/route.ts                 # POST   {inbox} -> candidates | unreadable
src/app/api/ideas/manual/route.ts               # POST   compose -> {ideaId}
src/app/api/ideas/[ideaId]/route.ts             # DELETE remove (soft-delete)
src/app/api/ideas/[ideaId]/refresh/route.ts     # POST
src/app/api/ideas/[ideaId]/interpretation/route.ts   # PUT
src/app/api/ideas/connectors/[inbox]/retry/route.ts  # POST
src/app/components/intake/intake-board.tsx      # "use client": wraps BoardScreen; supplies onManualRead, pending, FlowController.compose, intake actions context; router.refresh() after writes
src/app/components/intake/candidate-review-sheet.tsx (+ .module.css)
src/app/components/intake/idea-provenance-section.tsx (+ .module.css)
src/app/components/intake/intake-api.ts         # typed fetch wrappers
src/app/components/detail/detail-panel.tsx      # EDIT (sibling-owned, card-detail-and-source-health-ui): render the section when detail.intake is present
src/app/components/board/board-screen.tsx       # EDIT (sibling-owned, workflow-board-ui): optional revealCardId prop
src/app/page.tsx                                # EDIT: render <IntakeBoard view=.../>
src/app/dev/ui/intake/page.tsx + src/app/dev/ui/fixtures/intake.ts   # preview (guard first; "Preview - fixture data")
src/instrumentation.ts                          # listener host + connector sync + retention
src/server/env.ts                               # EDIT: ideaListenerEnabled, inboxConnectorsFile
```

## Risks / Trade-offs

- **[Five sibling-owned files — four source files and one test file — edited by a change that does not own them]** → Every source edit is additive: one call site in the board provider (`board-view.ts`), one optional member in the detail view model (`card-detail-view-model.ts`), one conditional render in the detail panel (`detail-panel.tsx`), and one optional `revealCardId` prop on the board screen (`board-screen.tsx`, Decision 11). The sibling **test** edit is declared rather than hidden: `src/server/board/board-view.test.ts` has only its assertions about the Idea lane's cards, listener state and `manualRead`, about `compose`, and about `sourceHealth` updated — exactly the behavior that sibling's own Forward note assigns here — and **no assertion is deleted without a replacement**; every other assertion in the file must pass unmodified. `src/app/page.tsx` (one component swap) and `src/server/env.ts` (two flags) are app-level, not sibling-owned. All of it is confined to a single late task group. If a sibling's final applied shape differs from what this design quotes, **conform to the sibling's literal text** and report the discrepancy rather than editing the sibling.
- **[`workflow-board`'s "intake is not enabled" scenario is no longer produced in production]** → Once this change ships, the provider stops emitting "Idea intake is not enabled for this installation yet." for an installation that has intake. Mitigation: that scenario remains a valid **rendering** contract — a disabled control whose supplied reason is visible as text — and it stays exercised by the board fixtures and the `/dev/ui/board` preview. The sibling's spec text is not edited and its rendering assertions are not removed; only the production provider stops producing that particular reason.
- **[The save-time re-read can store text the reviewer did not approve]** → The reviewer approved candidate text A, and between the listing and the Save the source may hold newer text B — B is what the server reads, hashes, and stores. It also costs one `getItem` per Save against a server that may rate-limit. Mitigation: the stored snapshot is what the source said **at save time**, which is the more truthful record of what was captured and the only one whose hash covers exactly what was stored; the board data is re-requested after every save, so the card shows the stored title immediately and a difference is visible rather than silent; and saves are human-paced — one row at a time, one read each, capped at 50 rows in view.
- **[The board's Load ideas menu says "captures snapshots", but this change captures at Save]** → The menu sentence "Reads the selected source now and captures snapshots. Never writes back." is `workflow-board-ui`'s and is not edited here. The candidate sheet's subline — "Read just now. Nothing is saved until you choose Save. Never writes back." — is what the reader sees at the moment of decision, so the flow is truthful where it matters. A one-line amendment to the board spec's menu copy would remove the remaining imprecision; it is deliberately **not** done in this change, which edits no sibling spec.
- **[`register()` runs at build time, twice in dev, or before migrations]** → Next.js calls `register()` during a production build, again after every dev HMR reload, and on a cold boot where `/api/health` — today's only `runMigrations` call site — has never been reached, so the tables may not exist. Mitigation: Decision 8's three guards, in order. The `NEXT_PHASE === "phase-production-build"` check returns before anything opens the database or reads the connector file; `runMigrations` runs **first**, ahead of the connector sync, the retention sweep, and the timer, and a failure there returns without setting the guard so the next registration retries; and the `globalThis.__jumphourIntakeHost` flag, set only once the idempotent steps have run, keeps a repeat registration from starting a second set of timers. Each step also logs one line and never throws out of `register()`, so a failed boot step degrades the lane rather than the app.
- **[An in-process timer on a multi-instance deploy]** → Two instances would tick the same installation. Mitigation: each tick claims its row with a conditional `UPDATE … WHERE next_attempt_at = ?`, so the loser updates zero rows and returns; the claim is portable ANSI, so it keeps working if Postgres later replaces SQLite.
- **[The listener is off by default, so most deploys show "Listener not configured"]** → Intended. A lane that claims to listen while nothing runs is the honesty failure the UI brief's rule 2 names; `not-configured` is the true statement until an operator enables the host and configures a connector.
- **[A permanently misconfigured connector keeps the Idea lane `delayed` forever]** → Also intended: the lane speaks for every inbox, and one that never succeeds is a real degradation. Source health names the culprit, its status word, and that an operator must fix its configuration, so the lane's vagueness is resolved one click away.
- **[A per-installation connector is coarse]** → Anyone signed in to the installation can read that Jira inbox, and every Idea is attributed to the connector's scope rather than to a person's own access. Mitigation: per-user OAuth is deferred (epic Q12); until then health is status-only, no surface offers credentials, and each save records the acting `github_user_id`.
- **[Hash and display could drift]** → The hash covers the adapter-normalized payload exactly as retrieved, and nothing display-side feeds it — no sanitizer, no trimming for presentation, no markdown pass. A rendering change can therefore never alter an Idea's stored identity, and a stored hash is displayed rather than recomputed.
- **[The same issue in two installations becomes two Ideas]** → Intentional, and specified. Identity is `(installation_id, source_kind, external_id)`. Operators must not "dedupe globally" by external id: cross-installation deduplication would be a tenancy leak wearing a cleanup's clothes.
- **[The detail payload grows with card count]** → Every Idea card carries its description, labels, timeline and provenance whether or not it is opened. Mitigation: the timeline is capped at 10 entries, `intake` and `detail` are both optional members, and `card-detail-and-source-health-ui`'s Decision 1 already records the revisit point — the projection change, when it defines card volume, can move detail behind a fetch without changing the panel's props.
- **[MCP servers may not exist in a given environment]** → Adapters are exercised by fixtures; a connector with no server or no credential is `misconfigured`, and Manual intake still works, so the product is demonstrable without a live Jira.

## Migration Plan

- **Deploy:** apply `0003_idea_intake_schema.sql` through the existing ordered migration runner. Ship after all four UI changes. Leave `JUMPHOUR_IDEA_LISTENER` unset and `JUMPHOUR_INBOX_CONNECTORS_FILE` unset for a first deploy: intake is then Manual-only, compose works, the Idea lane reports *not configured*, and source health reports no connections — every one of which is true. Enabling intake for an installation is two operator steps: write the connector file with the credential environment variables it names, then set `JUMPHOUR_IDEA_LISTENER=1`.
- **Rollback:** unset both environment variables. The listener stops, connector rows sync to empty on the next start, the Idea lane returns to *not configured*, and source health returns to no connections. Stored Ideas and snapshots remain; GitHub, GitLab, and Jira were never written to, so there is nothing external to undo. Reverting the commit additionally restores the sibling files to their pre-edit shape and leaves the four tables in place, unread. Drop the tables only when abandoning intake.
- **Forward:** the epic's projection change will later move promoted Ideas out of the Idea lane into the OpenSpec change lane, and may supersede `src/server/board/idea-lane.ts` entirely — its card mapping is the piece most likely to be replaced, while the tables, the adapter port, and the snapshot rules are not. Promote, when it lands, sets `promotion_snapshot_id = latest_snapshot_id` at submit time in one transaction; the promote dialog emits idea, repository, and change name only. Any later producer of cards or detail MUST keep building links through `toSafeLink`, relative times through `formatRelativeTime(…, generatedAt)`, and availability through the provider rather than re-deriving eligibility in the UI.

## Open Questions

- **Exact MCP server names in a deployed environment** (epic Q17). They do not change the port, the specs, or the task breakdown: the connector file names whatever is present and every other kind stays absent, so the Load ideas menu simply lists fewer options.
- **Per-user MCP OAuth** (epic Q12). Deferrable: adding it would add an identity join and a per-user credential path behind the same adapter port; the port's shape, the snapshot rules, and the tenancy key are unchanged either way.
- **Whether the compose fields `handoff-flow-dialogs-ui` deferred ever become data.** That change's Open Questions ask whether **Context and constraints**, **Repository**, or **Suggested owner** should become real manual-Idea fields. Context and constraints is the plausible one — free text with nowhere to go today. Repository would contradict "import without a repository is allowed" (epic Q13) and Suggested owner the epic's no-assignees non-goal, so both would need those decisions reopened first. Answering this later adds a column and a scenario; it changes no decision here.
