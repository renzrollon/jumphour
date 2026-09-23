## Why

Jumphour's signed-in surface today is an unstyled `<h1>`, an HTML table, and a sign-in anchor, and a plain OAuth sign-in ends on a raw JSON body rather than on that surface. The Claude Design board prototype describes a calm, accessible, light/dark product shell that the board, the card detail panel, and the handoff dialogs all sit inside — none of which can be built twice. This change lands that foundation first: one token system, one set of interaction primitives, one appearance preference, and one app shell, so the three UI changes that follow add screens instead of re-inventing surfaces, focus management, and theming.

## What Changes

- Introduce a **light and dark design token system** with WCAG AA contrast, a sans-serif interface face plus a **monospace companion** for repository slugs, issue keys, change names, and artifact paths, and a 4/8-point spacing rhythm. Dark mode is a considered system, not inverted light.
- Establish **interaction quality rules for every future surface**: visible keyboard focus, no state conveyed by color alone, honored reduced motion, comfortable touch targets on coarse pointers, accessible names on icon-only controls, and text-labeled source badges (GitHub, GitLab, `Jira · MCP`, Manual).
- Establish **one overlay behavior contract** shared by modal dialogs, side sheets, popovers, and menus: focus trap and focus restoration for modals, Escape-to-close when closing is safe, outside-click dismissal for non-modal surfaces, and arrow-key navigation for menus and radiogroup-style controls.
- Add **appearance preferences**: theme `System | Light | Dark` (default Light) and a `Cats` decorative toggle (default Off), persisted per browser, applied on the server's first paint so no wrong-theme flash occurs, with `System` following the operating system's current setting and later changes to it.
- Bind cats to **decoration only**: it may change a visible theme label but never an accessible name, the information architecture, critical copy, density, or any interaction.
- Add the **signed-in app shell**: a top app bar with the Jumphour mark and wordmark, a workspace label bound to the current GitHub App installation account, a search slot for a later change to fill, the theme control, the cats toggle, a Settings popover (Appearance and Cats only in this change), and an account menu showing the signed-in GitHub login with Sign out. It collapses on narrow viewports while keeping Settings and the account reachable.
- Add a **signed-out view** inside the same visual system, which offers GitHub sign-in and explains plainly when GitHub OAuth is not configured.
- **BREAKING (internal route contract):** a successful GitHub sign-in now lands the browser on the signed-in surface instead of returning a JSON body; a denied or failed sign-in lands on the signed-out view with a visible, non-secret notice and no session. Existing callback-route tests are updated to assert the redirect, not deleted.
- Add **local-only sign-out**: it ends the session and clears the session cookie without calling GitHub, and returns the browser to the signed-out view.
- Keep the existing **repository and discovery surface, its empty-state copy, and Refresh** behaving exactly as they do today; they are restyled inside the shell and still show no workflow board columns.
- Add an **opt-in UI preview index**, unreachable unless an explicit environment flag is set, so later changes can exhibit primitives and fixture-driven screens without exposing fixture data in production.
- Add **test infrastructure for interactive components** (a DOM environment and testing-library packages, pinned exactly), opted into per test file so the existing non-DOM test environment stays the default.

Out of scope: the four-column board and its toolbar, the card detail panel, source health, compose/launch/promote flows, the preview gallery's own capability contract and its board/panel/flow pages, any new SQL table or migration, and any GitHub call beyond what exists today.

## Capabilities

### New Capabilities

- `design-system`: the visual and interaction contract every Jumphour surface obeys — light and dark token systems at WCAG AA, typography with a monospace companion, non-color state encoding, focus visibility, reduced motion, coarse-pointer touch targets, source-badge labeling, and the shared overlay/menu/radiogroup keyboard and dismissal behavior.
- `appearance-preferences`: the per-browser theme and cats preference — its values, defaults, persistence, first-paint correctness, operating-system following, invalid-value recovery, single-source consistency across the controls that present it, and the strict limits on what cats may change.
- `app-shell`: the persistent signed-in frame and the signed-out entry — top app bar composition and the workspace label's binding to the real installation, Settings and account surfaces, sign-in landing, sign-in failure, local sign-out, responsive collapse, preservation of the repository/discovery surface, and the preview index's default unreachability.

### Modified Capabilities

- None. `github-app-installation`'s requirement "Present a thin signed-in repository and discovery surface" stays satisfied unchanged: the repository list and discovery status remain the signed-in surface in this change, restyled but not relocated, and still render no board columns. `workflow-board-ui` carries the delta that moves it.

## Impact

**Code.** New global stylesheet, token stylesheet, and font module imported only by the root layout; a shared UI primitive set and shell component set; one framework-free appearance module (cookie parse/serialize plus defaults); a new sign-out route; a preview guard plus the preview index page. Modified: the root layout (theme/cats stamping, fonts, shell), the signed-in page (restyled inside the shell; same data, same empty states, same Refresh), the OAuth callback route (redirect instead of JSON) and its tests, and the environment reader (one new optional flag).

**Dependencies.** Four development-only packages for DOM-based component tests, pinned exactly per CLAUDE.md with versions re-resolved from the registry at install: `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`. No new runtime dependency: styling is CSS Modules plus global token files, and fonts are self-hosted at build time. Changes 2 through 4 add no dependencies.

**Data and GitHub.** No new table, no migration, and no change to any stored row's meaning; sign-out deletes the session row it owns. Zero GitHub writes and zero new GitHub reads — sign-out makes no GitHub call at all, and Refresh's existing round trip is untouched.

**Environment.** One new optional variable gates the preview index; absent or unset means the index and every page under it responds as not found, including in development.

**Downstream.** Change 2 (`workflow-board-ui`) moves the repository surface to its own route, fills the shell's search slot, and adds shell navigation; change 3 adds a Settings section for source connections; change 4 adds flow overlays on top of this change's overlay contract. Each consumes this change's tokens, primitives, and appearance preference rather than introducing its own.
