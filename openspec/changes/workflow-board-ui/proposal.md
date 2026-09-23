## Why

The Claude Design prototype (`Jumphour Board prototype review/`) settles what the product's primary surface looks like, but the app a signed-in user reaches today is an unstyled repository table. Every later epic change — intake, attended launch, Promote, projection — needs somewhere to put its cards; without a board that already renders from a typed, provider-owned view model, each of them would invent its own surface (the pending intake change already plans a separate one). This change lands the board now, as an honest projection surface: real installation and repository data where it exists, and explicit "not configured" states where no backend exists yet — never the prototype's sample cards.

Depends on `design-system-and-app-shell` (tokens, primitives, shell, preview guard).

## What Changes

- Add the **four fixed lanes** — Idea → OpenSpec change → In progress → PR/MR — as the signed-in landing view. Lanes are a projection: no drag-and-drop, no status control, no editable column, no reordering.
- Add a **board view-model contract** and one **production provider**. The UI renders only what the provider derives; it never computes a card's lane, a listener's state, or an action's availability.
- Give every lane a **header** with title, count, derived-evidence sublabel, and a **truthful listener line**. "Listening every 5 min · Last heard …" appears only when a listener is reported as configured. Today every lane reports *not configured*.
- Expose manual read controls only where the listen/trigger contract allows them: **Load ideas** on the Idea lane (and the toolbar), **Fetch PRs/MRs** on the PR/MR lane. The two middle lanes never get one. A control whose availability is *unavailable* is disabled with a visible reason.
- Add the **board toolbar**: repository filter (by canonical repository identity), source filter, owner filter (options derived from owners present on cards; hidden when there are none), the derived-lifecycle legend, Load ideas, and Compose idea. Wire **search** into the shell's search slot.
- Add the **card anatomy** from the prototype: text-labeled source badge, source key, freshness, title (clamped), repository / owner / relevance, the evidence line that explains placement, optional agent-assistance note, footer. Cards are keyboard-operable, expose selected state, and reflect selection in the URL (`?card=<id>`). The panel a selection opens belongs to `card-detail-and-source-health-ui`.
- Add **first-use empty**, **intake-not-enabled**, **filtered-empty**, and **loading** states, with lane headers persisting through loading.
- Add **mobile** single-lane navigation (one lane at a time, horizontal lane tabs) instead of squashing four columns.
- **BREAKING (spec):** the signed-in landing `/` becomes the board. The repository and OpenSpec-discovery surface moves, unchanged in behavior, to `/repositories`, and Refresh returns there. The shell gains a two-item navigation: Board, Repositories.
- Add the **UI preview gallery** contract: an explicitly enabled, fixture-labeled set of pages that reproduces the prototype's board scenarios (`populated`, `loading`, `empty`, `filtered-empty`, `source-error`, `jira-failed`). Fixtures never reach a production route.

Out of scope: the detail panel, source health panel and banner (`card-detail-and-source-health-ui`); compose, launch, and Promote dialogs (`handoff-flow-dialogs-ui`); any inbox, listener, snapshot, projection, or session-evidence backend; any SQL table, migration, or GitHub call.

## Capabilities

### New Capabilities

- `workflow-board`: The fixed four-lane projection surface — lane headers and truthful listener state, lane-scoped manual read controls, toolbar filters and search, card anatomy and selection, empty / not-enabled / filtered-empty / loading states, and small-screen lane navigation — rendered exclusively from a provider-derived view model.
- `ui-preview-gallery`: An explicitly enabled, clearly labeled fixture gallery for reviewing every designed state against the prototype, isolated so that fixture data can never appear on a production route.

### Modified Capabilities

- `github-app-installation`: Requirement **"Present a thin signed-in repository and discovery surface"** changes. It forbade the four-column board outright ("in this change"). It now requires the repository and discovery surface to remain reachable and to never itself render board columns, while allowing the board to be the signed-in landing view.

## Impact

- **Routes:** `/` (signed-in) renders the board; new `/repositories`; new `/dev/ui/board`. `POST /api/github/refresh` and the OAuth callback's refresh branch change their return target from `/` to `/repositories`. Plain sign-in still lands on `/`.
- **Code:** new `src/lib/board/*`, `src/lib/time/*` (framework-free), `src/server/board/board-view.ts`, `src/app/components/board/*`, `src/app/repositories/page.tsx`, `src/app/dev/ui/board/*`; edits to `src/app/page.tsx`, the shell navigation and search slot, `refresh/route.ts`, `oauth/callback/route.ts` and their tests.
- **Dependencies:** none added. No SQL, no migrations, no GitHub REST calls; the provider reads only rows `github-app-installation` already stores.
- **In-flight change that must be re-pointed before it is applied:** `mcp-inboxes-and-idea-snapshots` still specifies a separate "intake surface without workflow board columns" (its `idea-intake` requirement of that name, tasks 7.5–7.6, and design Decision 6) and states that the four-column board is out of scope. Once this change lands, that intake UI belongs in this board's Idea lane, fed through this change's provider. This change does not edit that change; its owner should amend it first.
- **Assumptions:** owner is optional, display-only provenance and Jumphour never assigns (the epic's "no assignees" non-goal stands); cards may have no repository (the intake change allows repository-less Ideas); no listener exists yet, so *not configured* is the only listener state production can report today.
