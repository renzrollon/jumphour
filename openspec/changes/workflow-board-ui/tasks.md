Prerequisite: `design-system-and-app-shell` is applied (tokens, primitives, shell with search slot, `getInstallation`, preview guard, pinned jsdom/testing-library). This change adds no dependency, no SQL, and no GitHub call.

Groups 2, 3, and 4 depend only on group 1 and own disjoint files, so they can run in parallel. Group 5 needs 3 and 4. Groups 6 and 7 need 5.

## 1. View-model contract and pure functions (`src/lib/board/`, `src/lib/time/`)

- [x] 1.1 Add `src/lib/board/board-view-model.ts` with `LaneId`, `SourceKind`, `Tone`, `ListenerState`, `Availability`, `RepositoryRef`, `CardViewModel`, `ManualRead`, `LaneViewModel`, `BoardViewModel` exactly as named in design.md Decision 1 (4-tuple `lanes`, ISO strings, no functions), and verify `npm run typecheck` passes and a type-level test rejects a three-lane tuple
- [x] 1.2 Add `src/lib/board/lanes.ts` with `LANE_IDS` and `LANES` (title, sublabel, loadingLabel, legendRule per lane, copy from prototype lines 97–100 and 678–681), and verify a test asserts the order `idea, openspec-change, in-progress, pr-mr` and the four sublabels verbatim
- [x] 1.3 Add `src/lib/board/source-presentation.ts` mapping every `SourceKind` and badge to `{label, badgeVariant, viaMcp}`, and verify labels are exactly `GitHub`, `GitLab`, `Jira · MCP`, `Manual` and that an exhaustive-switch test fails to compile if a `SourceKind` is unmapped
- [x] 1.4 Add `src/lib/time/format-relative-time.ts` (`formatRelativeTime(iso, now)`), and verify "2 min ago", "1 h ago", "2 d ago", that an instant 40 s after `now` yields "just now", and that no input yields a negative duration
- [x] 1.5 Add `src/lib/board/listener-text.ts` (`formatListenerState`), and verify all four statuses: `not-configured` → "Listener not configured" with a null interval line; `never-heard` → "Listening every 5 min" + "Not heard yet"; `healthy` → "Last heard 2 min ago"; `delayed` → delayed/retrying wording plus "Last successful listen 14 min ago" and `degraded: true`
- [x] 1.6 Add `src/lib/board/filter-cards.ts` with `normalizeQuery`, the owner key, `filtersActive`, and the card predicate, and verify: `pay-184`, `  PAY-184  `, and `ＰＡＹ-１８４` match the same card; a whitespace-only query is inactive; the repository filter compares `githubRepoId` so two cards with different `fullName` and one id both match; a card with `repository: null` passes every repository filter; source + repository filters combine with AND
- [x] 1.7 Add a purity test for `src/lib/**` (extend change 1's if it exists), and verify it fails when a file under `src/lib/` imports `react`, `next/*`, or anything under `src/server/`

## 2. Production provider (`src/server/board/`)

- [x] 2.1 Add `src/server/board/board-view.ts` exporting `buildBoardView(driver, session, now)`, returning `installation: null`, empty `repositories`, and four empty lanes when the session has no installation, and verify with a unit test on a migrated in-memory database
- [x] 2.2 For a session with an installation, return the account from `getInstallation` and repositories from `listInstallationRepositories`, four lanes with `cards: []` and `listener: {status: "not-configured"}`, and verify `generatedAt` equals the injected `now`
- [x] 2.3 Attach `manualRead` only to `idea` (`load-ideas`) and `pr-mr` (`fetch-pull-requests`), each `unavailable` with the reasons in design.md Decision 2, set `compose` unavailable, and verify the two middle lanes have `manualRead: null`
- [x] 2.4 Verify tenancy: with installations A and B stored, a session on A yields only A's repositories and nothing of B's
- [x] 2.5 Verify the provider is read-only: a recording driver sees no `INSERT`/`UPDATE`/`DELETE`, and the existing GitHub method recorder sees zero GitHub requests during `buildBoardView`

## 3. Card, lane, and state components (`src/app/components/board/board-card.*`, `lane.*`, `lane-header.*`, `lane-empty.*`, `empty-board.*`, `board-skeleton.*`, `owner-avatar.*`)

- [x] 3.1 Build `BoardCard` as article + heading + stretched `aria-pressed` button (design.md Decision 5) rendering badge, key, freshness, title, context row, evidence, agent note, footer, omitting absent optionals, and verify with `renderToStaticMarkup` that a manual card with no key/repository/owner renders none of them and no "Unassigned" text
- [x] 3.2 Render every card string as a text node and clamp the title to three lines with CSS, and verify a title of `<img src=x onerror=alert(1)> Fix login` appears escaped in the markup, a 400-character title is fully present in the button's accessible name, and a source-scan test finds no `dangerouslySetInnerHTML` under `src/app/components/board/`
- [x] 3.3 Build `OwnerAvatar` choosing one of four token pairs by a stable hash of the owner key, and verify the same name always maps to the same pair and the stylesheet contains no hex color literal
- [x] 3.4 Build `LaneHeader` (title, count, sublabel, listener lines from `formatListenerState`, manual-read control), and verify a `not-configured` lane renders "Listener not configured" and never the string "Listening every", and a degraded lane carries its state in text
- [x] 3.5 In `LaneHeader`, render a manual-read control only for `idea` and `pr-mr`, disabled with the reason as visible text when unavailable, and verify a model that wrongly attaches a `manualRead` to `in-progress` renders no control there
- [x] 3.6 Build `Lane` and `LaneEmpty` with the filtered-empty copy ("No Jira ideas match this repository", "No in progress items match these filters") and the nothing-derived copy ("Nothing derived into PR/MR yet"), and verify "Reset filters" appears only when filters are active and "Compose idea" only in the Idea lane
- [x] 3.7 Build `EmptyBoard` with the first-use variant and the intake-not-enabled variant (disabled actions with visible reasons) plus the cats-on accent, and verify neither variant contains any fixture title and the not-enabled variant explains that idea intake is not enabled for this installation yet
- [x] 3.8 Build `BoardSkeleton` with four real lane headers, count "…", "Checking listener…", per-lane `loadingLabel`, and `aria-busy="true"`, and verify all four titles and sublabels are present in the markup

## 4. Toolbar, menus, legend, search (`src/app/components/board/board-toolbar.*`, `manual-read-menu.*`, `legend-popover.*`, `board-search.*`)

- [x] 4.1 Build the repository, source, and owner filters; repository options come from `view.repositories` deduped by `githubRepoId`; the owner filter lists distinct owner keys plus "No owner" and is not rendered when no card has an owner, and verify both the populated and ownerless cases in a jsdom test
- [x] 4.2 Build the manual-read menu used by Load ideas and Fetch PRs/MRs with the two read-only notices verbatim, text-labeled options, and MCP marks, and verify choosing an option calls `onManualRead(kind, optionId)` once, and that an unavailable control opens no menu and calls nothing
- [x] 4.3 Build the legend popover from `LANES` with the three required statements, and verify the four rules appear in board order, Escape closes it, and focus returns to the "How column placement works" button
- [x] 4.4 Build the search field for the shell's search slot with label "Search ideas, specs, PRs, and MRs", and verify it is rendered in the slot on the board and the slot is empty on `/repositories`

## 5. Board screen (`src/app/components/board/board-screen.*`, `lane-selector.*`, `board.module.css`)

- [x] 5.1 Build `BoardScreen` (`"use client"`) holding filter, search, selection, active-lane, and open-popover state, deriving visible cards and counts only through `filter-cards.ts`, and verify in jsdom that filtering to one repository updates every lane count and keeps an unbound Idea card visible
- [x] 5.2 Fall back to "All repositories" when the selected `githubRepoId` is absent from a re-rendered `view.repositories`, and verify by re-rendering with a shorter repository list
- [x] 5.3 Implement selection with `aria-pressed`, a non-color ring, toggle-off on second activation, single selection, and Enter/Space activation, and verify each with user-event
- [x] 5.4 Mirror selection to `?card=<id>` with `router.replace` and initialise from it, and verify an unknown id selects nothing, renders no error text, and that selection survives a filter that hides the card
- [x] 5.5 Build the small-screen lane selector (`role="tablist"`, titles + counts) driving `data-active-lane`, with CSS that shows one lane under 760px and hides the selector at 760px and above, and verify the attribute changes on tab activation and the stylesheet contains both media rules
- [x] 5.6 Verify the board exposes no manual placement: no element under the board has a `draggable` attribute, a drag handle, or a status control
- [x] 5.7 Wire `pending` and `onManualRead` props (unused in production), and verify that while `pending` the lanes show skeletons and headers keep their listener text

## 6. Routes and navigation (`src/app/page.tsx`, `src/app/repositories/`, `src/app/loading.tsx`, `src/app/error.tsx`, shell nav, refresh routes)

- [x] 6.1 Change signed-in `src/app/page.tsx` to render `BoardScreen` from `buildBoardView`, showing the installation-required explanation with a link to Repositories when `installation` is null, and verify the signed-out branch is unchanged
- [x] 6.2 Move the repository table, installation picker, empty-state copy, and Refresh form verbatim into `src/app/repositories/page.tsx`, redirecting signed-out visitors to `/`, and verify the existing repository-table and empty-state tests still pass and the page renders no lane titles
- [x] 6.3 Add the Board / Repositories navigation to the shell with `aria-current="page"` and the under-760px placement in the account menu, and verify the current item is marked on each route
- [x] 6.4 Add `REFRESH_RETURN_PATH = "/repositories"` to `src/server/github/refresh-return-state.ts` and use it for both early redirects in `refresh/route.ts` and the refresh branch of `oauth/callback/route.ts`, and verify updated route tests assert `/repositories` for all three while the plain sign-in test still asserts `/`
- [x] 6.5 Add `src/app/loading.tsx` (board skeleton) and `src/app/error.tsx` ("The board could not be loaded" + retry, never fixtures or an empty board), and verify the error view's markup contains no card and no lane count

## 7. Preview page and fixtures (`src/app/dev/ui/board/`, `src/app/dev/ui/fixtures/board.ts`)

- [x] 7.1 Transcribe the prototype's 13 cards (lines 661–675) into `src/app/dev/ui/fixtures/board.ts` as `CardViewModel`s with timestamps offset from a fixed `generatedAt`, and verify the lane distribution is 4 / 3 / 3 / 3 and "Snapshot 14 min ago" renders for the first card
- [x] 7.2 Add `parseScenario` (trim + lowercase, unknown → `populated`) and the six scenario view models with the prototype's listener effects, and verify `Loading` and ` loading ` both resolve to `loading`, `does-not-exist` resolves to `populated`, and `source-error` yields a delayed In progress lane and a 48-minute PR/MR last success
- [x] 7.3 Add `src/app/dev/ui/board/page.tsx` calling the preview guard first, showing "Preview — fixture data" and the active scenario name, with a preview-only handler that simulates a 1.4 s pending read, and verify it 404s when `JUMPHOUR_UI_PREVIEW` is unset, `true`, `0`, or ` 1 `, and renders when it is `1`
- [x] 7.4 Confirm the guard-enumeration structure test created by `design-system-and-app-shell` (its task 10.4) picks up `src/app/dev/ui/board/page.tsx` without edits, tighten it so its failure message names the unguarded page as the `ui-preview-gallery` spec requires, and verify it fails against a temporary unguarded page and names that page — do not add a second copy of the test
- [x] 7.5 Confirm the fixture-import structure test created by `design-system-and-app-shell` (its task 10.5) covers `src/app/dev/ui/fixtures/board.ts`, `src/server/board/`, `src/lib/`, and `src/app/components/board/`, tighten it so its failure message names the offending module, and verify it fails against a temporary import added to `src/server/board/board-view.ts` and names that file — do not add a second copy of the test

## 8. Verification

- [x] 8.1 Run `npm test` and `npm run typecheck`, and verify both pass with no skipped or weakened tests
- [x] 8.2 With `JUMPHOUR_UI_PREVIEW=1`, open `/dev/ui/board` for each of the six scenarios in light and dark themes at 1440px, 1024px, and 400px, and verify against the prototype that lanes, card anatomy, toolbar, empty/loading states, and the lane selector match, noting any deliberate deviation listed in design.md
- [ ] 8.3 Signed in without the preview flag, open `/`, and verify zero cards, four "Listener not configured" headers, disabled Load ideas / Compose idea with visible reasons, real repositories in the filter, and that Refresh on `/repositories` returns to `/repositories`
