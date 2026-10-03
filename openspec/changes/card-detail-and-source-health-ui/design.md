## Context

See `proposal.md` — Why. This is change 3 of four that port the Claude Design board prototype (`Jumphour Board prototype review/Jumphour Board.dc.html`) into the Next.js app. The binding decisions shared by all four are in `.claude/handoff/explore-claude-design-ui-integration.md`; this design implements its "Change 3" boundary and does not re-open its stack, token, file-layout, or view-model decisions.

What already exists when this change starts:

- **Change 1** (`design-system-and-app-shell`) owns tokens, the primitives in `src/app/components/ui/` (including `Sheet`, `Popover`, `Menu`, `Banner`, `Badge`, `SourceBadge`), the single overlay implementation that owns focus trap, Escape, focus restoration, outside click and scroll lock, the Settings popover, the `/dev/ui` preview guard, and `uiPreviewEnabled` in `src/server/env.ts`.
- **Change 2** (`workflow-board-ui`) owns `src/lib/board/board-view-model.ts`, `lanes.ts`, `source-presentation.ts`, `listener-text.ts`, `filter-cards.ts`, `src/lib/time/format-relative-time.ts`, the production provider `src/server/board/board-view.ts`, the board screen at `/`, and card selection — the selected card id and its `?card=<id>` round trip. Change 2 stops at selection; the panel it opens is this change.

Production reality today bounds every honesty decision below: there is no listener, no inbox, no projection, and no session-evidence backend. The provider returns four lanes with `cards: []` and `listener: { status: "not-configured" }`. So this change's production output is a detail panel that never opens (no cards exist to select) and a source health panel that says no sources are connected. Everything else is exercised through fixtures in the preview gallery and through unit tests.

Behavioral contracts: `specs/card-detail/spec.md` and `specs/source-health/spec.md`. The pending data-side rules this UI must stay consistent with are in `openspec/changes/mcp-inboxes-and-idea-snapshots/specs/source-provenance/spec.md` (untrusted imported content, no source write-back, installation isolation); this change does not edit them.

## Goals / Non-Goals

**Goals:**

- One rendering boundary for snapshot text and one for source-originated links, so "untrusted imported content" is a property of the code path rather than of each component's discipline.
- A detail panel whose every visible affordance traces to a value the provider supplied, including the absence of an affordance. No eligibility is derived in the view.
- Operational honesty that degrades in the right direction: a failed read looks like a failed read, an unconfigured listener looks unconfigured, and an empty installation looks empty.
- A hide mechanism that is obviously local: per browser, per installation, reversible, and invisible to the source and to other viewers.
- Additive integration. Change 2's files gain a mount point, a provider field, and a filtered card list; they are not restructured.

**Non-Goals:**

- The compose, launch, and promote dialogs (change 4). This change emits launch and promote *intents* and stops there.
- Any provider that produces real `detail` or real `sourceHealth` rows. Producing them is the projection and intake changes' work; this change defines the shape and the honest empty output.
- A sanitizer. Snapshot text is rendered as text nodes, which needs no sanitizer; the data-side `sanitizeForDisplay` named in `mcp-inboxes-and-idea-snapshots` is a different boundary and is not consumed here.
- Server-side or cross-device persistence of hidden cards.
- Any change to how a source is connected, authenticated, or configured.

## Decisions

### 1. Detail travels on the card, as `CardViewModel.detail`

`CardDetailViewModel` is an optional field on the card the board already has, not a separate fetch keyed by card id.

**Why:** The board view model is built once per request by a single provider and already carries `generatedAt`, which every relative time is computed against. A lazy fetch would need a second endpoint, a second `generatedAt` (so the panel's "14 min ago" could disagree with the card's), a loading state inside the panel, and its own installation-scoping check. With the panel opening from an already-rendered card, an embedded field makes the panel a pure function of data the page holds: selection becomes a lookup, `?card=` deep links resolve without a round trip, and the "unknown card id opens nothing" rule is a failed lookup rather than a 404 to design around.

**Trade-off:** payload size. Every card carries its description, acceptance text, labels and timeline whether or not it is ever opened. With the prototype's thirteen fixture cards this is a few kilobytes; at a few hundred cards it stops being free.

**Revisit when** the projection change lands and defines how cards are produced at scale. The field is optional (`detail?`), so a later provider may omit it and add a fetch without changing the panel's props — the panel already has to handle `detail` being absent.

**Rejected:** a per-card detail endpoint (cost above, with no benefit while the provider has no cards); duplicating the card's shared fields inside `detail` (two sources for title, source and repository, which is exactly the drift the invariant sweep exists to prevent).

### 2. Selection lives in the URL and is owned by change 2; this change only consumes it

Change 2 owns the selected card id and its `?card=<id>` representation. This change reads that id, looks the card up in the board view model, and renders the panel when the lookup succeeds. Closing the panel is a selection change — change 2's concern — not panel-local state.

**Why:** Two owners of "which card is selected" is two sources of truth and a guaranteed desync between the card's selected styling and the panel's contents. The URL is also what makes "Copy link" meaningful: the in-app link is the current address with `?card=<id>`, so copy has nothing to construct and nothing to keep in sync.

**Consequences this change must honor:** an id that matches no card in the current view model, or one in this viewer's hidden set, resolves to no panel and no error — the board renders as if nothing were selected. Focus restoration targets the card element that owns that id; when the deep link arrives with no originating card (a fresh load), dismissal restores focus to the board region rather than to a card that was never focused.

**Rejected:** panel-local open/closed state synchronized to the URL by an effect (races with back/forward); a route segment such as `/card/<id>` (loses board context on desktop, and the board is the thing the panel must not replace).

### 3. Text nodes only, and a two-layer safe-link check

Snapshot description, acceptance text and labels are rendered as React text children. `dangerouslySetInnerHTML` appears nowhere in `src/app/components/detail/`, and a unit test asserts that by scanning the directory's sources.

Links are checked **twice**, at two different boundaries:

| Layer | Where | What it does |
|---|---|---|
| Provider boundary | `toSafeLink(href, label)` in `src/lib/board/safe-href.ts`, called wherever a `CardDetailViewModel` or `SourceHealthViewModel` is built | Returns `SafeLink \| null`. Normalizes (strip leading/trailing whitespace and C0/C1 control characters, then lowercase the scheme) and allows only `http:` and `https:`. A rejected href yields `null`, so the unsafe address never enters the view model. |
| Render boundary | One `<SafeExternalLink>` in `src/app/components/detail/` | Re-runs the same predicate on the `SafeLink` it is handed. If it fails, it renders the label as plain text. It is the only component in this change that emits an `<a href>` from source-derived data, and it always emits `target="_blank" rel="noopener noreferrer"`. |

**Why two layers, given one function:** they fail differently. The provider layer is the one that can be forgotten — a future provider (real MCP adapters, the projection change) constructs view models in code this change will never see, and nothing in the type system stops `{ href: rawFromJira, label }` from being written as a `SafeLink`. The render layer cannot be forgotten, because it is the only way a link reaches the DOM. Keeping both means a provider mistake degrades to plain text instead of to a `javascript:` link, which is the whole point. The cost is one redundant string check per link.

Normalization order is load-bearing and is what the specs' edge case exercises: trim and strip control characters *before* reading the scheme, and compare the scheme case-insensitively. `  JaVaScRiPt:` must be rejected, and `HTTPS://…` must be accepted.

**Rejected:** a sanitizer library (a new runtime dependency to solve a problem text nodes already solve; the brief forbids new dependencies in changes 2–4); rendering snapshot markdown (the prototype does not, the design prompt does not ask for it, and it would reintroduce the HTML boundary this change removes); checking only at the provider (one forgotten call site is an executable link); checking only at render (the unsafe address still travels through the view model and into any log, test fixture or serialized payload that touches it).

### 4. Hidden cards: one hook over `localStorage` key `jumphour:hidden:<installationId>`

`useHiddenCards(installationId)` in `src/app/components/detail/` owns the whole mechanism: read on mount, add, clear-all, and the hidden count. It stores a JSON array of card ids under `jumphour:hidden:<installationId>`. Every read and write is wrapped in `try/catch`; on failure the hook keeps the set in React state only and reports `persisted: false`, which the UI does not surface as an error. The board screen consumes the set to filter lane cards *before* counts are computed, so a lane's count and its list can never disagree.

**Why the key is installation-scoped:** hidden ids are opaque card ids, and the same id string can legitimately exist in two installations. Tenancy isolation is a product rule everywhere else (`source-provenance`, change 1's installation model); a single shared key would leak one workspace's view state into another on the same browser.

**Why not a database table:** it would be the first row this change writes, the first migration, and the first thing to keep in sync across changes — for state that is per-viewer, per-browser, cosmetic, and fully reconstructible by pressing "Show all". It would also make a local view preference look like a workflow status, which is the one thing this product refuses to build. The brief and CLAUDE.md both hold this change to no new SQL.

**Why not a cookie:** cookies are sent on every request to every path, so an unbounded list of card ids becomes request weight on every page load and every API call, for data the server never reads. Change 1 uses cookies for appearance because the *server* must read them to avoid a flash of the wrong theme; nothing server-rendered depends on the hidden set.

**Why hydration-safe:** the hidden set is read in an effect after mount, never during render, so server and client markup agree on first paint and the hidden cards disappear on the first client pass. The brief's "no JS viewport measurement" rule has the same motivation and this follows it.

**Rejected:** `sessionStorage` (loses the set on a new tab, which breaks "survives reload" in the way users actually reload); one global key with installation ids nested inside (same leak surface, more parsing); a per-card "hidden" flag on the view model (the server does not know and must not know).

### 5. One side panel at a time

Card detail and source health are the same slot. Opening source health clears the card selection; selecting a card closes source health. This is enforced in one place — the board screen holds `sidePanel: { kind: "detail", cardId } | { kind: "source-health" } | null` derived from change 2's selection plus a local source-health flag — rather than by each panel closing the other.

**Why:** two 440px panels side by side leave no board, which defeats the reason the detail view is a panel and not a route. It also keeps focus management tractable: exactly one overlay is mounted, so change 1's overlay hook has one focus trap and one restoration target at a time. The prototype already behaves this way (`openSources` clears `selectedId`), so this is porting behavior rather than inventing a rule.

**Consequence:** Escape unwinds innermost-first. With the overflow menu open, Escape closes the menu and leaves the panel open; the second Escape closes the panel and restores focus to the card.

**Rejected:** stacking panels; a tabbed panel holding both (source health is workspace-scoped and card detail is card-scoped — tabbing between them implies they are two views of one subject).

### 6. The lane listener line in the timeline is composed at render, not trusted from the provider

`CardDetailViewModel.timeline` carries provider-authored entries. The lane's listener line is **not** one of them. The detail panel appends it by reading the lane's title from change 2's `LANES` record and its listener text from `formatListenerState(lane.listener, generatedAt)`, for the lane the card is actually in.

**Why:** the prototype hard-codes `"Idea lane · listening every 5 min · last heard 2 min ago"` into each fixture card's timeline (lines 662–674). Porting that would give the board two listener strings that can disagree — the lane header saying "not configured" while the panel says it listens every five minutes — which is precisely the honesty failure rule 2 of the brief forbids. One formatter, one string, two readers.

**Rejected:** requiring providers to duplicate the formatted string into every card's timeline (N copies to keep correct, and the provider would have to know the render-time `now`).

### 7. Timestamps: ISO fields format at render; `timeline[].when` is provider-authored text

Fields typed as ISO-8601 (`CardViewModel.freshness.at`, `SourceConnectionViewModel.lastSuccessAt`) are formatted at the render boundary with change 2's `formatRelativeTime(iso, generatedAt)` — so the snapshot line, the source-health rows and the card age all agree, and the server and client produce the same string with no ticking clock.

`timeline[].when` is deliberately a display string rather than an ISO timestamp, because the prototype's entries mix times ("14 min ago", "Latest 18 min ago") with non-temporal qualifiers ("Read-only projection", "Session evidence unavailable", "Eligible for interlock:spec"). The rule that keeps this honest: **where a provider derives `when` from a timestamp it MUST use `formatRelativeTime` against the same `generatedAt`**, never an ad-hoc format. The invariant table below records the timeline as a reader of that formatter on those grounds.

**Rejected:** splitting `when` into `{ at: string | null; qualifier: string | null }` (changes the view-model contract the brief fixed, for a distinction the panel would immediately re-join into one line); formatting the relative time in the panel from a raw timestamp the provider does not have.

### 8. Production provider output today

`src/server/board/board-view.ts` gains exactly one field and no new behavior:

- `sourceHealth = { sources: [], banner: null }` — no source is connected, so the panel renders its "no sources are connected" state and no banner is rendered anywhere. The four lane listener rows still render, all reading not-configured, from the lanes the provider already returns.
- `detail` stays **absent** on every card, because the provider returns `cards: []`. There is no card to carry a detail, and inventing one would be fixture data in production.

A unit test asserts both: `sourceHealth.sources` is empty and `banner` is null for a real installation, and the panel's rendered output contains no source name.

**Rejected:** shipping a "demo" source row behind a flag; defaulting `sourceHealth` to `undefined` and letting the panel decide (the difference between "the provider has not been updated" and "there are genuinely no sources" is exactly what this panel exists to show, so the provider states it explicitly).

### 9. Fixtures and the `/dev/ui/panels` preview

`src/app/dev/ui/fixtures/panels.ts` holds this change's fixtures: a detail fixture per source kind (GitHub imported with permalink, Jira via MCP, GitLab, manual with no permalink), a hostile-content fixture whose description contains `<script>` and instruction-shaped text, an unsafe-scheme fixture (`javascript:`, `data:`, mixed-case and whitespace-prefixed variants), and source-health fixtures reproducing the prototype's `source-error` (GitHub unreachable, In progress listener delayed, PR/MR last successful listen 48 min ago) and `jira-failed` (Jira via MCP unavailable with its distinct banner copy) scenarios, plus a `none` scenario with zero sources.

`src/app/dev/ui/panels/page.tsx` calls change 1's preview guard itself, responds 404 when `JUMPHOUR_UI_PREVIEW` is not `1`, shows the persistent "Preview — fixture data" label, and selects scenarios with `?scenario=populated|source-error|jira-failed|none`, mirroring the prototype's props.

**Why fixtures rather than a seeded provider:** the brief's honesty rule 1 — production routes render only real installation-scoped data, and no production module imports a fixture. Change 1's preview structure test (its contract is change 2's `ui-preview-gallery` spec) that no file under `src/server/` or a production route imports from `src/app/dev/ui/fixtures` covers this change's fixtures automatically.

### 10. This change adds no dependency, no SQL, and no GitHub call

No entry in `package.json` changes. No migration is added, no table is created, no query is written. No REST call is issued — CLAUDE.md's zero-GitHub-writes rule is not even reached, because this change makes no GitHub request at all, read or write. "Retry <source>" emits an intent; the read it will eventually trigger belongs to the intake change. The only new environment interaction is reading `localStorage` in the browser.

### 11. Integration seam — the three files this change touches but does not own

Parallel implementers need this explicit, because these are the only places where this change's work meets change 1's and change 2's files:

| File | Owner | What change 3 adds |
|---|---|---|
| `src/app/components/board/board-screen.tsx` (board screen) | 2 | Mounts the side-panel slot and the source banner; filters lane cards through `useHiddenCards` before counts are computed; renders the "N hidden · Show all" affordance. |
| `src/app/components/shell/` (Settings popover) | 1 | One "Source connections" section plus the "Open source health" entry, below the existing Appearance and Cats sections. |
| `src/server/board/board-view.ts` | 2 | The `sourceHealth = { sources: [], banner: null }` field. |

Everything else this change writes is new: `src/lib/board/safe-href.ts`, `src/lib/board/card-detail-view-model.ts`, `src/lib/board/source-health-view-model.ts`, `src/app/components/detail/`, `src/app/components/sources/`, `src/app/dev/ui/panels/page.tsx`, `src/app/dev/ui/fixtures/panels.ts`. Task groups below are cut so that only the last integration group touches the three shared files.

## Invariant sweep — shared/derived values

Values this change **owns** (computed here, consumed here and later):

| Value | Canonical form | Computed where | Readers (all must consume the canonical form) | Owner |
|---|---|---|---|---|
| Safe link | `toSafeLink()` — trim whitespace and control characters, lowercase scheme, allow only `http:`/`https:`; returns `SafeLink \| null` | `src/lib/board/safe-href.ts` | detail header permalink; evidence-timeline entry links; the overflow menu's "Open source" item (offered only when the result is non-null); source-health "View connection details"; change 4's promote-success links | 3 |
| Hidden cards | `Set<cardId>` persisted as a JSON id array at `jumphour:hidden:<installationId>` | one hook, `useHiddenCards()` | board lane lists; lane counts; the "N hidden · Show all" affordance; the detail panel (closes when its card is hidden); `?card=` deep-link resolution (a hidden id resolves to no panel) | 3 |

Values this change **reads** and must not re-derive (owned by changes 1–2):

| Value | Canonical form | Computed where | This change's readers | Owner |
|---|---|---|---|---|
| Lane identity + copy | `LANE_IDS` + the `LANES` record | `src/lib/board/lanes.ts` | source-health lane listeners list (lane order and titles); detail evidence-timeline lane line | 2 |
| Source presentation | `SourceKind`/badge → label + badge variant | `sourcePresentation()` | detail header badge and "Open in <source>" label; source-health rows; the Settings "Source connections" list; the source status banner | 2 |
| Listener text | `formatListenerState(state, now)` | `src/lib/board/listener-text.ts` | source-health lane listeners list; detail evidence-timeline lane line — both must match the lane header character for character | 2 |
| Relative time | `formatRelativeTime(iso, generatedAt)` | `src/lib/time/format-relative-time.ts` | detail snapshot line (`freshness.at`); source-health row last-success times (`lastSuccessAt`); banner last-success time; timeline `when` wherever a provider derives it from a timestamp (Decision 7) | 2 |
| Card lane / action eligibility | `laneId`, `Availability` | the provider | detail action slots; retry controls — rendered, never derived. The prototype's `canSpec = lane === 'idea'` is explicitly not ported | 2 / 3 |
| Repository identity | `githubRepoId` (display `fullName`) | the GitHub boundary | detail metadata repository row — displayed only; never string-compared | 2 |

## Risks / Trade-offs

- **[Payload grows with card count]** Every card carries its detail whether or not it is opened (Decision 1). → Mitigation: `detail` is optional, so a later provider can omit it and add a fetch without changing the panel's props; revisit when the projection change defines card volume.
- **[A future provider forgets `toSafeLink`]** Nothing in the type system distinguishes a checked `SafeLink` from a hand-built object literal. → Mitigation: the render boundary re-checks (Decision 3), so the failure mode is a link degrading to plain text, not an executable address. A unit test feeds hostile hrefs through a hand-built `SafeLink` and asserts plain-text output.
- **[Two listener strings drift]** The panel could show a different listener line than the lane header. → Mitigation: the panel composes the line from the same formatter and the same lane state (Decision 6); a test renders a lane header and a detail panel from one view model and asserts string equality.
- **[Hidden cards look like a status]** A viewer may read "hidden" as "archived" or "done". → Mitigation: the menu item is labelled "Local view only. Source is not changed."; the count affordance is always visible while anything is hidden; "Show all" is one action away.
- **[Hidden set outlives its cards]** Ids accumulate for cards that no longer exist in any view model. → Mitigation: unknown ids are inert (they filter nothing) and the count affordance reports only ids present in the current view model, so a stale id never inflates the count. A future cleanup pass is not needed for correctness.
- **[The panel has nothing to show in production]** Detail is unreachable today and source health renders one empty state, so the surface ships largely unexercised by production traffic. → Mitigation: the preview gallery and unit tests cover every state from fixtures; the empty states are themselves specified and tested, because they are what production actually renders.
- **[Three shared files, four parallel authors]** Touching change 1's and change 2's files risks a merge conflict. → Mitigation: Decision 11 names them, and every task that touches one is confined to the final integration group.
- **[`localStorage` blocked]** Private browsing or blocked site data makes persistence fail silently. → Mitigation: the hook degrades to session-only hiding and reports `persisted: false`; no error is shown, because a cosmetic preference failing to persist is not an error the viewer can act on.

## Migration Plan

- **Deploy:** ship with the other three changes or after them; there is no data migration, no environment variable, and no GitHub App permission change. On deploy, the signed-in board gains a source health panel that reports no connected sources and lanes that report no configured listener — both true statements about the current backend.
- **Rollback:** remove the panel mount from the board screen and the `sourceHealth` field from the provider. Nothing persists server-side, so there is nothing to undo. A viewer's `jumphour:hidden:<installationId>` entry becomes inert data in their browser; it is re-honored if the change is re-deployed and otherwise harmless.
- **Forward:** the intake and projection changes populate `detail` and `sourceHealth` with real rows. They MUST build every link through `toSafeLink` and every relative time through `formatRelativeTime(…, generatedAt)`; they MUST NOT write a lane listener line into `timeline`. Change 4 replaces this change's action intents with the dialogs they open and consumes the same `Availability` values without re-deriving eligibility.

## Open Questions

- Whether the hidden-card affordance should also list *which* cards are hidden, rather than only a count and "Show all". Deferrable: the specs require a count and a restore-all path; adding a list is additive and changes no contract.
- Whether the staleness threshold that separates "healthy" from "stale snapshot" is per source or workspace-wide. Deferrable: the threshold is applied by whichever change first produces real `SourceConnectionViewModel` rows; this change renders the `status` it is given and never computes it.
- Whether "View connection details" eventually navigates to a settings route or expands in place. Deferrable: it is a source-health affordance whose destination does not exist yet in any change; it renders and emits an intent, and the specs require only that it is offered and that it is not a credential-entry surface.
