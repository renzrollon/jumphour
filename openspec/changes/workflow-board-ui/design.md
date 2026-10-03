## Context

See `proposal.md` for why. The signed-in surface today is `src/app/page.tsx`: a server component that reads stored, installation-scoped rows and renders an unstyled repository table. `design-system-and-app-shell` wraps that in the shell and supplies tokens, primitives (Menu, Popover, Select, Badge, SourceBadge, Skeleton, Button), the search slot, and the preview guard. This change assumes all of that exists.

Nothing that would feed a board exists yet: no `ideas` table, no listener, no projection, no session evidence, no PR/MR reads (`mcp-inboxes-and-idea-snapshots` is at 0/31 tasks; the rest of the epic is unproposed). The prototype (`Jumphour Board prototype review/Jumphour Board.dc.html`, lines 69–120, 142–261, 650–684, 716–761) computes everything — lane membership, eligibility, "last heard" copy, viewport mode — inside one client component over hard-coded sample data. Porting that literally would ship a convincing fake.

Constraints that shape the approach: CLAUDE.md (zero GitHub writes; every query through the one driver interface; portable SQL; exact pins), the archived Change 1 design's Decision 4 (repository identity is `github_repo_id`; the board filter is a named future reader), and the epic's rule that the board is "a projection, not an editable process engine".

Behavioral contracts: `specs/workflow-board/spec.md`, `specs/ui-preview-gallery/spec.md`, and the MODIFIED delta in `specs/github-app-installation/spec.md`.

## Goals / Non-Goals

**Goals:**

- One typed, serializable board view model; one production provider that is the only place lane membership, listener state, and availability are derived.
- The prototype's board, toolbar, card, empty, loading, and mobile presentation, rebuilt on change 1's tokens and primitives.
- A production board that is truthful today (real repositories, empty lanes, listeners *not configured*, intake *unavailable*) and needs no UI change when a later change starts supplying cards.
- A preview page that reproduces every prototype board scenario from fixtures, so fidelity is reviewable now.

**Non-Goals:**

- Any data source for cards. The provider's card list is empty in production until a later change fills it.
- The detail panel, source health, banner, or any dialog. Selection here ends at "this card is selected".
- Client-side polling, a ticking clock, websockets, optimistic updates.
- Persisting filters or search. They are per-visit client state.
- New dependencies, SQL tables, migrations, API routes (other than the refresh return target), or GitHub calls.

## Decisions

### 1. A framework-free view model is the only input to the board

`src/lib/board/board-view-model.ts` defines `BoardViewModel`, `LaneViewModel`, `CardViewModel`, `ListenerState`, `Availability`, `ManualRead`, `RepositoryRef`, `SourceKind`, `Tone` exactly as named in the shared brief (`.claude/handoff/explore-claude-design-ui-integration.md`, "View-model contract"). `src/lib/` imports no React, no `next/*`, and nothing from `src/server/`, so the same types and pure functions serve the server provider, client components, fixtures, and tests.

The model is plain JSON: ISO-8601 strings, no `Date`, no functions, no class instances. It crosses the server→client boundary as a prop.

`lanes` is a fixed 4-tuple in `LANE_IDS` order. The provider cannot return three lanes or reorder them, and the UI does not sort them.

**Why:** the prototype's defect is that the UI derives truth. A model that carries `laneId`, `listener`, and `Availability` as data makes "the UI never derives" structural rather than a convention. Later changes (intake, launch, projection) extend the provider, not the components.

**Rejected:** components that read SQL rows directly (couples presentation to a schema that does not exist yet). A client-side store that merges several fetches (no second fetch exists; invites client derivation). Deriving `laneId` from `source`/`evidence` in the UI as the prototype does (`canSpec = lane === 'idea'`, line 761).

### 2. One production provider; truthful defaults today

`src/server/board/board-view.ts` exports `buildBoardView(driver, session, now): BoardViewModel`. Today it:

- reads the installation account via `getInstallation(driver, installationId)` and repositories via `listInstallationRepositories(driver, installationId)` — both through the existing `SqlDriver` interface, both already installation-scoped (`getInstallation` is added by `design-system-and-app-shell` for the workspace label; this change only consumes it);
- returns `installation: null` and empty `repositories` when the session has no installation;
- returns four lanes with `cards: []` and `listener: { status: "not-configured" }`;
- returns `manualRead` on `idea` (`load-ideas`) and `pr-mr` (`fetch-pull-requests`) only, each `unavailable` with the reasons fixed in the brief; `compose` likewise `unavailable`.

`now` is injected so `generatedAt` is deterministic in tests.

If a later provider erroneously attaches a `manualRead` to a middle lane, the lane header ignores it: the header renders a manual control only for `idea` and `pr-mr` (spec "middle lanes never get a manual control"). This is the one place the UI is deliberately stricter than its input, because the rule is a locked product boundary rather than derived state.

**Why not show "Listening every 5 min"?** No listener runs. The design prompt's per-lane interval line is a contract for when listeners exist; `not-configured` is the honest rendering until then. `never-heard`, `healthy`, and `delayed` are modelled and rendered now so the listener changes need no UI work.

**Rejected:** a provider that returns fixture cards behind a flag (fixtures would be one env var from production). Hiding the lanes until data exists (the board *is* the product surface; an empty, explained board is the truthful first-run state).

### 3. Server page builds the model; one client component owns interaction state

`src/app/page.tsx` stays a server component: signed out → change 1's sign-in view; signed in → `buildBoardView(...)` → `<BoardScreen view={...} />`. `BoardScreen` (`"use client"`) owns exactly: repository / source / owner filter values, search query, selected card id, the active small-screen lane, and which toolbar popover is open. Everything it shows is `view` passed through pure functions from `src/lib/board/`.

The shell's search slot (change 1) receives the search field from `BoardScreen` through the shell's slot prop; on `/repositories` the slot is empty.

**Rejected:** putting filters in the URL (adds history noise and server re-renders for a purely presentational narrowing; selection is the only state worth linking to). Server-side filtering (a round trip per keystroke for a list already in memory).

### 4. Canonical values — normalize once, enumerate every reader

This change introduces the shared values below. Each is computed in one module; every reader imports it. No component re-implements one.

| Value | Canonical form | Computed in | Readers in this change | Later readers (must keep consuming the canonical form) |
| --- | --- | --- | --- | --- |
| Lane identity and copy | `LANE_IDS` tuple + `LANES: Record<LaneId, {title, sublabel, loadingLabel, legendRule}>` | `src/lib/board/lanes.ts` | lane headers, small-screen lane selector, legend popover, filtered-empty and nothing-derived copy, loading labels, preview scenario page | source-health lane-listener list and detail timeline (change 3) |
| Source presentation | `sourcePresentation(kind \| badge) → { label, badgeVariant, viaMcp }`; labels `GitHub`, `GitLab`, `Jira · MCP`, `Manual` | `src/lib/board/source-presentation.ts` | card badge, source filter options, Load ideas menu rows, Fetch PRs/MRs menu rows, filtered-empty copy ("No Jira ideas…") | detail header, source-health rows, Settings source list (3); compose footer, launch and promote headers (4) |
| Repository identity | `githubRepoId`; `fullName` is display only | GitHub boundary, already stored by `github-app-installation` | repository filter options (deduped by id, labelled from `BoardViewModel.repositories`), filter predicate, card repository text | launch and promote repository selectors (4) |
| Search query | `normalizeQuery(q)` = NFKC → trim → collapse internal whitespace → lowercase; `""` means "no query" | `src/lib/board/filter-cards.ts` | filter predicate, `filtersActive` flag, filtered-empty vs nothing-derived copy, Reset filters | none planned |
| Card search text | `normalizeQuery(title + key + changeName + evidence.text)` | `filter-cards.ts` (same function as the query) | filter predicate only | none planned |
| Listener text | `formatListenerState(state, now) → { intervalLine \| null, heardLine, degraded: boolean }` | `src/lib/board/listener-text.ts` | lane header | source-health lane-listener list, detail timeline lane line (3) |
| Relative time | `formatRelativeTime(iso, now)`; clamps future instants to "just now"; always against `generatedAt` | `src/lib/time/format-relative-time.ts` | card freshness ("Snapshot 14 min ago"), `formatListenerState` | detail snapshot line, timeline, source-health rows (3) |
| Owner key | `displayName` after NFC + trim; "No owner" for `null` | `filter-cards.ts` | owner filter options, owner predicate, avatar color choice | none planned |
| Card lane / availability | `laneId`, `Availability` | provider (`board-view.ts`) | every component renders them; none derives them | detail actions (3), flow entry points (4) |
| Refresh return path | constant `REFRESH_RETURN_PATH = "/repositories"` | `src/server/github/refresh-return-state.ts` | `refresh/route.ts` (both early redirects), `oauth/callback/route.ts` (refresh branch) | none planned |

Rules that follow from the table:

- The repository filter compares `githubRepoId` numbers. It never compares `fullName` strings, so a renamed repository's stale card still matches (spec edge case). A card with `repository: null` passes every repository filter (epic §8 `workflow-board`: "cards linked to it plus unpromoted ideas").
- Query and card text go through the *same* `normalizeQuery`, so `ＰＡＹ-１８４`, `  pay-184 `, and `PAY-184` cannot diverge between the two sides of the comparison.
- `filtersActive` is derived from the normalized query, so a whitespace-only query is inactive and lanes show "Nothing derived into … yet", not a filtered-empty message.
- If the selected repository id is absent from `view.repositories` after a re-render, the filter falls back to "All repositories".

### 5. Card markup: article + heading + stretched button

Each card is an `<article>` whose `<h3>` contains a `<button aria-pressed>` holding the title; the button's `::after` covers the card so the whole card is the hit target. The badge/key row is referenced by `aria-describedby`. Title text is clamped to three lines with CSS; the accessible name is the full title.

**Why:** the prototype wraps an `<h3>` inside a whole-card `<button>` (lines 213–239). Button content is presentational to assistive technology, so the heading is lost and the accessible name becomes the concatenation of every string on the card. The stretched-button pattern keeps a heading per card, a short name, and a full-card target.

Selected state is `aria-pressed="true"` plus a 2px ring (shape change, not only color). All card text is rendered as React text nodes; there is no `dangerouslySetInnerHTML` anywhere in `src/app/components/board/`, and a test asserts it.

Owner avatars take one of four token pairs (`--accentSoft/--accent`, `--greenSoft/--green`, `--amberSoft/--amber`, `--jiraSoft/--jira`) chosen by a stable hash of the owner key. The prototype's `OWNER_COLORS` are light-theme hex literals (line 651) and are unreadable in dark mode.

**Rejected:** `<a href="?card=…">` cards (selection toggles; a link that deselects on second activation is surprising). `role="listbox"` lanes (cards are not options; arrow-key-only navigation would hide them from Tab users).

### 6. Selection lives in the address as `?card=<id>`

`BoardScreen` initialises the selected id from the `card` search parameter and writes it back with `router.replace` (no history entry per click). An id that is not in `view` selects nothing — silently, because the provider has already scoped `view` to the installation, so "not mine" and "does not exist" are indistinguishable by construction (spec: cross-installation address reveals nothing). Selection survives filtering while the card still exists in `view`; it clears when the card disappears from `view`.

Change 3 reads the same selected id to open the detail panel; it does not introduce a second selection state.

**Rejected:** selection in component state only (no deep link for change 3's "Copy link"). `router.push` (Back would step through every card the user glanced at).

### 7. Responsive behavior is CSS-only

All four lanes are always in the DOM. The board container carries `data-active-lane`; under 760px a media query displays only the matching lane and shows the lane selector (`role="tablist"`); at 760px and above the selector is `display: none` (so it leaves the accessibility tree) and lanes sit in a horizontally scrolling flex row (`flex: 1 0 272px; max-width: 440px`, from the prototype). No component reads `window.innerWidth`.

**Why:** the prototype keeps viewport width in React state (line 701). Under server rendering that guarantees a hydration mismatch or a first-paint flash of the wrong layout.

**Trade-off:** on a phone, three lanes' cards are rendered but hidden. At V1 card counts this is negligible; revisit if a lane routinely exceeds a few hundred cards.

### 8. Loading, error, and pending states

- Route-level loading: `src/app/loading.tsx` renders the board skeleton — four real lane headers (title + sublabel from `LANES`, count "…", listener line "Checking listener…") over shimmer placeholders with the lane's `loadingLabel`, `aria-busy="true"`. Shimmer is disabled under `prefers-reduced-motion` by change 1's global rule.
- Provider failure: `src/app/error.tsx` shows "The board could not be loaded" with a retry. It never falls back to fixtures or to an empty board.
- Manual-read pending: `BoardScreen` accepts `pending?: boolean` and `onManualRead?: (kind, optionId) => void`. Production passes neither (every manual read is `unavailable`). The preview passes a handler that flips `pending` for 1.4 s, matching the prototype's `startLoading`. While pending, headers keep their last known listener text.

### 9. Routes, navigation, and the refresh return target

- `/` signed in → board. `/` signed out → change 1's sign-in view (unchanged).
- `/repositories` → the existing repository table, installation picker, empty-state copy, and Refresh form, moved verbatim from `page.tsx` into `src/app/repositories/page.tsx`. A signed-out visitor to `/repositories` is redirected to `/`.
- The shell gains a two-item nav — Board (`/`), Repositories (`/repositories`) — with `aria-current="page"`. Under 760px the two links move into the account menu.
- `refresh/route.ts` redirects to `/` in two early-exit branches and the OAuth callback redirects to `/` after a refresh. All three switch to the single `REFRESH_RETURN_PATH` constant. A *plain* sign-in keeps landing on `/` (the board). Existing route tests that assert `/` for the refresh branches are updated deliberately; the plain sign-in assertion is untouched.

**Why move rather than embed:** the living spec requires the repository view to stay thin and free of board columns. Two routes keep both requirements independently testable.

### 10. Preview page and fixtures

`src/app/dev/ui/board/page.tsx` calls change 1's guard first, then renders `BoardScreen` with a fixture `BoardViewModel` chosen by `?scenario=` (`parseScenario` = trim + lowercase, unknown → `populated`). Fixtures live in `src/app/dev/ui/fixtures/board.ts`: the prototype's 13 cards (lines 661–675) transcribed to `CardViewModel`, with timestamps expressed as offsets from a fixed `generatedAt` so "Snapshot 14 min ago" reproduces deterministically. Scenario effects mirror the prototype (lines 752–757): `source-error` → In progress `delayed/retrying`, PR/MR last success 48 min; `jira-failed` → Idea lane degraded. The banner and panel for those two scenarios arrive with change 3.

Two structure tests back the `ui-preview-gallery` spec: one walks `src/app/dev/ui/**/page.tsx` and fails on any page that does not call the guard before rendering; one walks `src/server/**` and every `src/app/**` file outside `src/app/dev/ui/` and fails on any import that resolves into `src/app/dev/ui/fixtures`. Both are **created by `design-system-and-app-shell`** (its tasks 10.4–10.5), because the first preview page and the fixtures directory land there. This change owns their *contract*, not a second copy: it confirms they pick up the board preview page and `fixtures/board.ts` without edits, and tightens them only where the spec asks for more than they already assert — the failure message must name the offending page or module.

**Rejected:** Storybook (a new toolchain and dependency tree for four pages). Fixtures under `src/lib/` (would make them importable from production code without tripping the path-based test).

### 11. Testing approach

Pure functions (`filter-cards`, `listener-text`, `format-relative-time`, `source-presentation`, `lanes`, `parseScenario`) and the provider are tested in the default `node` environment. Static presentation (card, lane header, empty states, skeleton) uses `renderToStaticMarkup`, like the existing component tests. Interaction (filters, search, selection + address, menus, lane selector, disabled manual reads) uses change 1's pinned `jsdom@30.1.0` + `@testing-library/react@16.3.3` + `@testing-library/user-event@14.6.7` with a per-file `// @vitest-environment jsdom` docblock. This change adds no dependency.

### 12. Deliberate deviations from the prototype

Task 8.2 compares `/dev/ui/board` against the prototype. These differences are intended and are not fidelity defects:

- **Card markup** — article + heading + stretched button instead of a whole-card `<button>` (Decision 5).
- **Owner avatar colors** — token pairs instead of the prototype's light-only hex literals (Decision 5).
- **Healthy listener wording is one phrase on every lane.** The prototype's PR/MR header reads "Last successful listen 14 min ago" while healthy; the board reads "Last heard 14 min ago". The spec fixes healthy wording as "Last heard …" ("Show a truthful listener state on every lane"); "Last successful listen" belongs to a delayed listener only.
- **A degraded listener says so in words.** In `source-error` the prototype marks the PR/MR lane only by coloring "Last successful listen 48 min ago" amber. The board reads "Listening delayed · Last successful listen 48 min ago", in amber, because state is never carried by color alone (design-system spec). In Progress keeps the prototype's "Listening delayed · retrying".
- **Icon geometry** — the external-host mark and the other icons come from change 1's 16×16 icon set, not the prototype's SVG paths.
- **Loading placeholders** — a lane reading data shows its `loadingLabel` as a visible caption at any motion setting (as the prototype does). The shimmer stops under reduced motion.

## Risks / Trade-offs

- **[An empty board reads as "broken"]** → The not-enabled state says why and names what will populate it; the preview shows the populated design. The alternative — sample cards in production — is the failure the epic warns about.
- **[The in-flight intake change contradicts this one]** → `mcp-inboxes-and-idea-snapshots` still forbids board columns and plans a separate intake surface. If it is applied unamended after this change, two competing surfaces result. Mitigation: proposal Impact names the exact requirement, tasks, and decision to amend; it should be re-pointed before apply.
- **[View-model drift across four changes]** → Changes 3 and 4 extend types this change owns. Mitigation: names are fixed in the shared brief; extensions are optional fields (`detail?`, `sourceHealth?`), so this change compiles alone and later changes do not edit existing members.
- **[`?card=` leaks existence across installations]** → It cannot: lookup is against the already installation-scoped `view`; an unknown id and a foreign id take the same silent path. A test covers it.
- **[CSS-only lane switching hides content from phone screen readers]** → Intended: hidden lanes are `display: none`, the lane selector exposes all four with counts, and switching is one activation.
- **[Owner appears to be an assignment feature]** → Owner is optional, display-only, never editable, and the filter disappears when no card has one. The epic's "no assignees" non-goal is unchanged.
- **[Moving the repository table breaks the Refresh round trip]** → Three redirect sites share one constant and each has a route test.

## Migration Plan

- **Deploy:** ship after `design-system-and-app-shell`. No migrations, no env changes (the preview flag belongs to change 1). Signed-in users land on the board; Repositories is one click away. Bookmarks to `/` now show the board.
- **Rollback:** revert the commit. `/repositories` disappears and `/` renders the repository table again; no stored data is affected because this change writes none.
- **Forward:** the intake change fills `lanes[0].cards` and flips `load-ideas` / `compose` to `available` inside `buildBoardView`. Listener changes replace `not-configured`. Neither requires a component change.

## Open Questions

- Whether merged or closed PRs/MRs ever appear on the board (epic Q5) is a provider/projection decision; the four-lane model here does not change either way.
- Whether filters should persist per user is deferrable; it would add storage, not change the contract.
