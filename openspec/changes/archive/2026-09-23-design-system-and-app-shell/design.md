## Context

See `proposal.md` for motivation. Behavioral contracts: `specs/design-system/spec.md`, `specs/appearance-preferences/spec.md`, `specs/app-shell/spec.md`.

What exists today: a Next.js App Router application whose root layout renders `<html><body>{children}</body></html>` with no stylesheet, no font, and no shell; one page (`src/app/page.tsx`) that branches on the session cookie into a bare sign-in anchor or an unstyled repository table; three presentational components under `src/app/components/`, all tested with `renderToStaticMarkup` under Vitest's `node` environment; and a GitHub OAuth callback that answers a plain sign-in with `NextResponse.json(...)` — so the visible result of signing in is a JSON body, not the application. There is no sign-out path at all: `src/server/db/sessions.ts` exports `getSession` and `setSessionInstallation` only. `src/server/db/installations.ts` exports only `upsertInstallation` and `src/server/db/users.ts` only `upsertUser`, so no read exists today for the two names the shell must display truthfully.

The visual source is `Jumphour Board prototype review/Jumphour Board.dc.html`, a Claude Design artifact. Its runtime (`support.js`) is not ported; its inline `style=`/`style-hover=` attributes, its `window.innerWidth` responsiveness, and its sample data are prototype mechanics, not product decisions. Product truth is `docs/jumphour-claude-design-prompt.md`. Binding cross-change decisions — boundaries, file layout, token names, view-model contract, dependency pins, prototype defects to fix — are in `.claude/handoff/explore-claude-design-ui-integration.md`; this design implements that brief for change 1 of 4 and does not reopen it.

Two project constraints shape everything below. CLAUDE.md pins every dependency literally, with versions re-resolved from the registry at install. CLAUDE.md also forbids GitHub writes: nothing in this change issues any GitHub request at all.

## Goals / Non-Goals

**Goals:**

- One token system and one type scale that changes 2 through 4 consume without adding CSS infrastructure of their own.
- One overlay implementation behind the dialog, sheet, popover, and menu primitives, so focus trapping, Escape, focus restoration, outside-click, and scroll lock are written and tested once.
- An appearance preference that is correct on the server's first byte, so there is no wrong-theme frame and no hydration mismatch.
- A shell whose every displayed identity comes from a stored row, with a truthful fallback when the row is missing.
- Sign-in that ends on the application and sign-out that exists, without touching GitHub.
- Test infrastructure for interactive components that leaves the existing fast `node` suite as the default.

**Non-Goals:**

- A component library, a design-token build pipeline, or a documented public API for the primitives beyond their props.
- Runtime theming beyond two presentations; no user-defined colors, no density setting, no font-size setting.
- Any viewport measurement in JavaScript, any client-side theme resolution, or any client-side routing work.
- The preview gallery's own capability contract and its board/panel/flow pages (changes 2–4), the board, the detail panel, source health, and the flow dialogs.
- New tables, migrations, GitHub calls, or any change to what Refresh does.

## Decisions

### 1. CSS Modules plus two global stylesheets; tokens keep the prototype's names and values

Styling is `*.module.css` next to each component (built into Next.js, zero configuration) over two global files: `src/app/tokens.css` (custom property definitions, both presentations) and `src/app/globals.css` (reset, base type, link and focus defaults, reduced-motion suppression, coarse-pointer target floor). Both are imported once, by `src/app/layout.tsx`.

Token names and values are the prototype's, verbatim from prototype lines 21–22: `--bg`, `--surface`, `--surface2`, `--surface3`, `--border`, `--border2`, `--ink`, `--ink2`, `--ink3`, `--accent`, `--accentHover`, `--accentSoft`, `--accentInk`, `--green`/`--greenSoft`, `--amber`/`--amberSoft`, `--red`/`--redSoft`, `--shadow`, `--shadowLg`, `--term`, `--termInk`, `--gh`/`--ghInk`, `--gl`/`--glSoft`, `--jira`/`--jiraSoft`, `--skeleton`. Keeping the names means a port of any prototype block is a mechanical translation, and a contrast regression is a single-file diff. The prototype's `style-hover=` pseudo-attributes become real `:hover` and `:focus-visible` rules; its inline styles become classes.

**Amended at apply (task 3.2):** three prototype values miss the AA floor in `specs/design-system/spec.md` and are darkened in `tokens.css`: `--border2` light `#cfcbc1` → `#8c8982` and dark `#43433c` → `#6e6e69` (the control border — text field, text area, switch track — was 1.3–1.85:1), and light `--gl` `#e24329` → `#c53a24` (GitLab badge text was 3.59:1). Menu item descriptions switch from `--ink3` to `--ink2` while the item carries the `--surface2` highlight (4.11:1 → 7.22:1). `src/app/contrast.test.ts` measures every used pair in both presentations; `--border` keeps the prototype's value and is exempt as a divider and as the outline of controls their own text identifies.

**Why:** No new runtime dependency, no bundler configuration, no class-name soup in JSX, and per-component scoping that keeps four parallel changes from colliding in one stylesheet. Custom properties are what makes the CSS-only theme resolution in Decision 3 possible.

**Rejected:** Tailwind — a build-step dependency and a second token vocabulary competing with the custom properties; the prototype's values would have to be re-expressed as a config. CSS-in-JS — runtime cost, and style injection on the client reintroduces exactly the first-paint problem Decision 3 exists to avoid. A component library (MUI, Chakra, Radix themes) — it would own the visual system this change is defining, and the product's visual direction is explicitly not a generic library look.

### 2. Fonts through `next/font/google`, isolated in one module imported only by the layout

`src/app/fonts.ts` declares Instrument Sans (interface) and JetBrains Mono (identifiers) via `next/font/google` and exports their CSS-variable class names; `src/app/layout.tsx` is the only importer and puts those classes on `<html>`. `tokens.css` reads them into `--fontSans` and `--fontMono` with fallback stacks `system-ui, sans-serif` and `ui-monospace, monospace`.

**Why:** `next/font/google` downloads and self-hosts the faces at build time, so there is no runtime request to a Google domain, no third-party connection on first paint, and no layout shift from a late-arriving face. Isolating it in one module keeps every other file free of font knowledge and makes swapping a face a one-file change.

**Rejected:** The prototype's runtime `<link rel="stylesheet" href="fonts.googleapis.com/...">` — a render-blocking third-party request on every load and a privacy dependency the product does not need. Committing `.woff2` files and hand-writing `@font-face` — more repository weight and a manual subsetting/unicode-range job for no gain over the build-time path.

### 3. Appearance lives in cookies, the server stamps `data-jh-theme`, and `system` is resolved by CSS alone

Two cookies, read and written by one pure module `src/lib/appearance/appearance.ts` (framework-free: no React, no `next/*`, no `src/server` import): `jumphour_theme` ∈ `system|light|dark` and `jumphour_cats` ∈ `on|off`. `SameSite=Lax`, `Path=/`, one-year max age, not `httpOnly` (they are not secrets, and a later client-side control may want to read them), and not secret-bearing in any log.

Parsing is exact string equality against those tokens — no trimming, no case folding, no aliasing. Anything else is treated as absent and yields the default (`light`, `off`), and the two values fall back independently. We write these cookies ourselves, so accepting only the canonical spelling removes a normalization surface rather than losing a real input, and it makes the tamper case and the corruption case the same well-defined path.

The layout reads the cookies on the server and stamps `data-jh-theme="light"` or `data-jh-theme="dark"` on `<html>` for an explicit choice, and stamps **nothing** for `system`. Cats stamps `data-jh-cats="on"` or nothing. `tokens.css` then resolves the presentation with the cascade only:

```
:root { /* light tokens */ }
@media (prefers-color-scheme: dark) { :root:not([data-jh-theme="light"]) { /* dark tokens */ } }
:root[data-jh-theme="dark"] { /* dark tokens */ }
```

`system` therefore follows the OS live, including a mid-session OS change, with no listener, no state, and no re-render — the media query does it. No JavaScript anywhere computes a "resolved theme"; nothing may read one.

Changing the preference is a server action (or a small form post) that sets the cookie and revalidates, so the next paint is already correct and the control's state comes from the same server-read value the layout used. That is what makes the top-bar control and the Settings popover structurally incapable of disagreeing.

**Why:** The preference must be known before the first byte or the viewer sees a light frame before a dark page. A cookie is the only browser-persisted value the server can read during render. CSS-only resolution of `system` means the server never has to know the OS setting — which it cannot know — and the client never has to correct the server, which is what produces hydration mismatches.

**Rejected:** `localStorage` plus a blocking inline `<script>` in `<head>` that stamps the attribute before paint — the standard workaround, but it is an unavoidable render-blocking script, it is invisible to the server so every server-rendered control would have to be corrected on the client, and the correction is a hydration mismatch by construction. Storing the preference in the database keyed by user — it is a per-browser preference, not a per-account one (a viewer on a dark laptop and a light phone wants both), it would not exist for a signed-out visitor who must still see the signed-out view in their theme, and it would add a table and a write path to a change that adds neither. A `system`-resolving JavaScript reader with a `matchMedia` listener — a second source of truth for a value CSS already knows, and the invariant sweep below forbids it.

### 4. One hand-rolled overlay primitive; native `<dialog>` and the popover API are not testable here

A single internal overlay module (focus trap, Escape, focus restoration, outside click, scroll lock, `aria-modal`/labelling) backs four exported primitives: `Dialog` (centered modal), `Sheet` (right-side modal), `Popover`, and `Menu`. Modal surfaces trap and restore; transient surfaces dismiss on Escape and outside click and return focus to their invoker; `Menu` and `SegmentedControl` add roving-tabindex arrow navigation. Escape resolves innermost-first, so a menu inside a dialog closes the menu and leaves the dialog — the prototype's flat `escape()` ladder (lines 707–715) is replaced by that stack rule. A `closeGuard` prop lets a caller refuse Escape while work is in flight, which is how change 4's launch sheet keeps a running session from being dismissed.

The decisive evidence is environmental, probed on 2026-09-19: **`jsdom@30.1.0` implements neither `HTMLDialogElement.showModal`, nor `inert`, nor the popover API.** A native `<dialog>` under test would be a non-modal block with no focus containment, so every modal behavior the design-system spec requires would be untestable in the only environment this project runs component tests in. Hand-rolling means the behavior under test is the behavior we wrote.

**Why:** The behavior contract (trap, safe Escape, restoration, outside click, arrow keys) is identical across all four surfaces; writing it once is the difference between four audits and one. Prototype defects (no focus trap, no restoration, no roving tabindex — brief "Prototype defects") are fixed in that one place.

**Rejected:** Native `<dialog>` with `showModal()` — correct in browsers, untestable here, and it would still need hand-written outside-click, restoration, and arrow-key code. Radix UI / Headless UI / Ark — a runtime dependency that owns focus management and styling hooks for the whole product, contradicting Decision 1's "no component library", and adding a version to pin and upgrade for four overlays. Deferring overlays to change 4 — changes 2 and 3 need popovers and menus first.

### 5. Test environment: `node` stays the default; DOM tests opt in per file

`vitest.config.ts` keeps `environment: "node"`. A test that needs a DOM begins with `// @vitest-environment jsdom`. Static, non-interactive components keep using `renderToStaticMarkup`, exactly as `repository-table.test.tsx` and `sign-in-link.test.tsx` do today; only genuinely interactive behavior (overlays, roving tabindex, toggles) pays for a DOM.

New devDependencies, exact pins resolved from the npm registry on 2026-09-19:

| Package | Pin | Why |
| --- | --- | --- |
| `jsdom` | `30.1.1` | The DOM environment Vitest loads for the opted-in files. |
| `@testing-library/react` | `16.3.3` | Render and act for React 19 components under test. |
| `@testing-library/dom` | `10.4.2` | Peer of the above; queries. Pinned explicitly so the peer is not floated. |
| `@testing-library/user-event` | `14.6.7` | Real key and pointer sequences — Tab, Escape, arrows — which the keyboard requirements are written in terms of. |

CLAUDE.md governs: the install task re-resolves each version from the registry and pins it literally (no `^`, `~`, `latest`); if the registry has moved, the same commit updates both `package.json` and this table.

Deliberately **not** added: `@testing-library/jest-dom` (its matchers are sugar over assertions we can write directly, and it is another pin), `@vitejs/plugin-react` (the existing suite already compiles TSX under Vitest's default transform, so nothing needs it), Storybook (the preview gallery in Decision 9 is the in-app substitute), Playwright (no e2e in this project; `.claude/testing/profile.json` records e2e as not configured). Changes 2–4 add no dependencies.

**Why:** The existing suite is fast because it does not build a DOM; making `jsdom` global would slow every server-module test for the benefit of a handful of component tests. A docblock is per-file, explicit, and greppable.

**Rejected:** `environment: "jsdom"` globally. An `environmentMatchGlobs` naming convention — it moves the decision into config where a reader of the test file cannot see it.

### 6. Sign-in lands on the application; the callback's existing tests change deliberately

`src/app/api/github/oauth/callback/route.ts` keeps everything it does today and changes only its terminal response. A successful plain sign-in becomes `303` to `/` with the session cookie set — the same landing the refresh branch already performs (route line 105), so the two paths converge instead of diverging. A denied, cancelled, or failed sign-in becomes `303` to `/?signin=failed`, with no session cookie. The signed-out view renders a fixed, non-secret notice for that marker; the failure `reason` — which can carry an internal error message — is not put in the URL, is not rendered, and is not logged to the client.

`route.test.ts` asserts today on the JSON body (`ok`, `signedIn`, `repositories`, `reason`). Those assertions are rewritten, not deleted: each becomes an assertion on the redirect — status `303`, the `Location`, the presence or absence of `Set-Cookie` for the session, and, for the failure cases, that the response carries no authorization code, token, or reason text. The facts each test was pinning down (a denied sign-in sets no session; a refresh round trip re-lists and returns to the surface; a thrown exchange does not 500) all survive; only the medium changes. The route's JSON-shaped contract had no other consumer — nothing in the codebase or in the living specs reads that body.

**Why:** "Sign in" ending on a JSON page is a visible product defect; the spec now says the destination is the application. Reusing the redirect the refresh branch already returns means one landing behavior, not two.

**Rejected:** Rendering an HTML page from the route handler — it duplicates the page the App Router already owns. Carrying the failure reason in the query string — a raw provider error in a shareable URL is an information leak with no user value. Deleting the failure assertions as "no longer applicable" — they are the evidence that a refused sign-in creates no session.

### 7. Sign-out is a local-only route

`src/app/api/session/signout/route.ts` accepts a `POST` from a plain form in the account menu, deletes the session row, expires the session cookie, and `303`s to `/`. It makes no GitHub request: Jumphour does not revoke the user's OAuth authorization or touch the App installation, so signing in again is immediate and no administrator has to reinstall anything. A `POST` with no cookie, or a cookie naming a session that no longer exists, takes exactly the same path and lands on the same view — sign-out is idempotent, and it never reports "you were not signed in".

`POST` rather than `GET` so a link prefetch or an image crawler cannot end someone's session.

**Why:** The account menu's only destructive-looking action must be honest about its blast radius: local session only. The alternative — revoking the GitHub grant — would make "sign out" quietly uninstall the product's access for the user.

**Rejected:** Calling GitHub's token-revocation endpoint (contradicts the local-only guarantee, and this change performs no GitHub calls). A `GET` sign-out link. A client-side-only cookie clear that leaves the session row live and reusable.

### 8. Three new database functions, named now because change 2 imports them

The shell must display the installation account login and the signed-in GitHub login, and sign-out must delete a session. None of the three reads exists. This change adds them with exactly these names and shapes, because change 2's board provider imports the first two:

| Function | File | Statement |
| --- | --- | --- |
| `getInstallation(driver, installationId): { installationId: number; accountLogin: string } \| undefined` | `src/server/db/installations.ts` | `SELECT github_installation_id, account_login FROM installations WHERE github_installation_id = ?` |
| `getUser(driver, githubUserId): { githubUserId: number; login: string } \| undefined` | `src/server/db/users.ts` | `SELECT github_user_id, login FROM users WHERE github_user_id = ?` |
| `deleteSession(driver, sessionId): boolean` | `src/server/db/sessions.ts` | `DELETE FROM sessions WHERE id = ?`, returning `changes > 0` |

Columns verified against `migrations/0001_core_schema.sql`. All three are plain portable ANSI SQL through the existing `SqlDriver` interface — no dialect syntax, no `RETURNING`, no direct import of the SQLite package (CLAUDE.md "Database portability") — and **no migration is required**: every column already exists.

Honesty rule for what they return. A missing row is a missing row: the workspace label renders the neutral "No installation" and the account menu renders a neutral account label. Neither ever renders a numeric identifier, an invented organization, or a prototype name — `Platform delivery` and `Priya Nair` are fixture strings from the prototype and appear nowhere outside the preview and tests. `deleteSession` returning `false` is not an error; Decision 7 treats it as already signed out.

**Why:** The shell cannot state an identity it has not read, and inventing one is precisely the "honesty over fidelity" rule the brief makes non-negotiable. Fixing the names here keeps change 2 from adding a near-duplicate reader.

**Rejected:** Joining the installation and user rows into the session read — it widens `SessionRow`, which four existing call sites depend on. Passing the account login through the session cookie — an unverified, staleable copy of a stored fact. Showing the numeric installation id as a fallback label — an identifier no user recognizes, presented where a name belongs.

### 9. Preview surfaces are gated by `JUMPHOUR_UI_PREVIEW=1`, enforced per page

`src/server/env.ts` gains `uiPreviewEnabled: boolean`, true only when `process.env.JUMPHOUR_UI_PREVIEW === "1"`. `src/app/dev/ui/preview-guard.ts` exports a guard that calls Next's `notFound()` when it is false. **Every** page under `src/app/dev/ui/` calls the guard as its first statement — a layout-level guard is not sufficient, because a route added later under a different layout, or a route handler, would silently escape it. A test enumerates `src/app/dev/ui/**/page.tsx` and fails if any file does not call the guard; a second test asserts that nothing under `src/server/` and no production route imports from `src/app/dev/ui/fixtures`.

Change 1 ships only `src/app/dev/ui/page.tsx`: the primitive and shell index, in both presentations, with a persistent "Preview — fixture data" label. Changes 2–4 add `board`, `panels`, and `flows` pages under the same guard and the same enumeration test.

Default off everywhere, development included, so a fixture board can never be mistaken for real data on a shared dev deployment. `notFound()` rather than a redirect or a 403, so a disabled deployment does not confirm the address exists.

**Why:** Four changes need a place to exhibit fixture-driven states; the honesty rule forbids fixtures reaching any production surface. An enumeration test is what keeps the guarantee true as pages are added by three other authors.

**Rejected:** `NODE_ENV !== "production"` as the gate — it turns on for every developer and every preview deployment by default. A middleware path match — one more place to keep in sync with the file tree, and it does not fail loudly when a page is added. Storybook — a large dependency tree and a second rendering environment for what one guarded route provides.

### 10. Responsiveness is CSS only; breakpoints 760px and 1100px

Layout adapts through media queries. Nothing measures `window.innerWidth`, and no component holds viewport state. The prototype's `width`-in-state approach (line 701) renders a server HTML tree for a guessed width and then corrects it on the client — a hydration mismatch and a visible reflow. Breakpoints are the prototype's: mobile below 760px, tablet below 1100px. Coarse-pointer target expansion is `@media (pointer: coarse)` and is independent of width, so a 1280px touchscreen gets large targets and a 700px mouse window does not.

**Why:** CSS is the only responsiveness that is correct in the first server-rendered frame.

**Rejected:** A `useMediaQuery` hook or a resize listener — correct only after hydration. A container-query-based shell — more machinery than a fixed two-breakpoint bar needs, and the breakpoints are already fixed by the prototype.

### 11. File layout and ownership, so four changes stay disjoint

Per the brief, this change owns: `src/app/layout.tsx`, `globals.css`, `tokens.css`, `fonts.ts`, `page.tsx` (restyled, still the repository surface), `src/app/components/ui/*`, `src/app/components/shell/*`, `src/app/api/session/signout/route.ts`, `src/app/dev/ui/page.tsx` and `preview-guard.ts`, `src/lib/appearance/appearance.ts`, the three database functions in Decision 8, `src/server/env.ts`, and the OAuth callback's terminal response. Primitives shipped: Button, IconButton, Select, TextField, TextArea, Badge, SourceBadge, Menu, Popover, Dialog, Sheet, Skeleton, Banner, Switch, SegmentedControl, and the icon set. The existing `repository-table.tsx`, `installation-picker.tsx`, and `sign-in-link.tsx` stay where they are and are restyled in place; their tests keep passing.

Change 2 adds `components/board/`, `src/lib/board/`, `src/server/board/`, `repositories/page.tsx`, and shell navigation plus search wiring; change 3 adds `components/detail/`, `components/sources/`, and a Settings section; change 4 adds `components/flows/` and `src/lib/flows/`. No later change edits this change's primitives except to add a prop.

## Invariant sweep — shared values this change owns

| Value | Canonical form | Computed where | Readers (all must consume the canonical form) | Notes |
| --- | --- | --- | --- | --- |
| Appearance preference | `{ theme: "system" \| "light" \| "dark"; cats: "on" \| "off" }` | `parseAppearance()` in `src/lib/appearance/appearance.ts`, from the two cookies; exact-match, invalid → per-field default | root layout (stamps attributes), top-bar theme control, top-bar cats toggle, Settings popover, preview gallery, signed-out view | One parser, one serializer. No call site reads `document.cookie` or `process.env` for these, and no component keeps its own copy of the choice. |
| Resolved theme (light vs dark actually shown) | The CSS cascade over `data-jh-theme` plus `prefers-color-scheme` | `tokens.css` only | every component, via tokens | **No JavaScript reader may exist.** There is no `useResolvedTheme`, no `matchMedia` listener, no `resolvedTheme` prop. A component that needs to look different in dark does it with a token or a `[data-jh-theme]` rule. |
| Cats decoration flag | `data-jh-cats="on"` on the root, from the same parsed preference | root layout | decorative CSS rules; the two theme-option visible labels | May change a visible label; may never change an accessible name, control set, copy, density, or interaction (`specs/appearance-preferences/spec.md`). |
| Workspace label | `accountLogin` from the stored installation row | `getInstallation()` (Decision 8) | top app bar workspace label, and change 2's board provider `installation.accountLogin` | Missing row → the neutral "No installation". Never a numeric id, never `Platform delivery`. |
| Signed-in account label | `login` from the stored user row | `getUser()` (Decision 8) | account menu | Missing row → a neutral account label. Never a numeric id, never `Priya Nair`. |
| Preview enablement | `uiPreviewEnabled: boolean` | `getEnv()` from `JUMPHOUR_UI_PREVIEW === "1"` | every page under `src/app/dev/ui/`, each calling the guard itself | Enforced by an enumeration test, not by a layout. |
| Session identity | the existing session cookie and `getSession()` | unchanged | shell (signed-in vs signed-out), sign-out route | This change adds `deleteSession` and reads `githubUserId`; it changes nothing about how a session is created. |

## Risks / Trade-offs

- **[Hand-rolled focus management is subtly wrong in a real browser]** → The one implementation is covered by DOM tests for trap, wrap, Escape, restoration, outside click, and arrow navigation, and the preview index exercises every primitive in both presentations for manual keyboard checking. Being one module, a browser-only fix lands in one place.
- **[`jsdom` diverges from browsers]** → Tests assert behavior we implement (focus moves, attributes, handlers) rather than layout or native modality. Nothing in the suite depends on `showModal`, `inert`, or the popover API, so a future `jsdom` that adds them changes nothing.
- **[Cookie-based preference is not `httpOnly` and is user-writable]** → It carries no authority and no secret; a tampered value is indistinguishable from a corrupt one and both resolve to the documented defaults (Decision 3). Worst case, a viewer sees the light theme.
- **[Callback test rewrite hides a regression]** → Each rewritten assertion keeps the fact it was pinning, restated against the redirect; the diff is reviewed for one-for-one coverage rather than net line count, and the new failure test explicitly asserts no session cookie and no secret in the response.
- **[Four token systems drift as changes 2–4 add surfaces]** → Token names and values are fixed here and later changes add components, not tokens; a new token is a change-1 file edit and therefore visible in review.
- **[Preview guard missed on a page added by another author]** → The enumeration test fails the suite the moment a page under `src/app/dev/ui/` does not call the guard, and every one of changes 2–4 adds exactly one such page.
- **[Restyling `page.tsx` changes what it shows]** → The existing component tests for the repository table and its empty states are unchanged by this change and must stay green; the app-shell spec restates the preservation requirement so it is tested, not assumed.
- **[Cats scope creep across three later changes]** → The spec's "same controls, same copy, same density, accessible names unchanged" scenario is the acceptance test; any later cats accent is decoration in a non-critical area or it is out of scope.

## Migration Plan

- **Deploy:** No migration, no data change, no GitHub configuration change. Ship the code; set `JUMPHOUR_UI_PREVIEW` only where a preview is wanted, and leave it unset everywhere else. Nothing else in the environment changes.
- **First-load behavior:** Existing browsers hold neither appearance cookie, so every returning viewer gets the documented Light default with cats off; no one is migrated into a stored preference.
- **Sessions:** Live sessions survive. The first request after deploy renders the same repository surface inside the new shell. The OAuth callback's new redirect affects only sign-ins started after deploy.
- **Rollback:** Revert the commit. The two appearance cookies become inert values no code reads and expire on their own; no row was written, no column was added, and no GitHub state was touched. A session created before the rollback is still valid afterwards.
- **Forward:** Changes 2–4 consume `src/app/components/ui/`, the appearance parser, `getInstallation`/`getUser`, the preview guard, and the token names as given. A later change that needs a new shared value adds a row to an invariant-sweep table rather than a second reader of an existing one.

## Open Questions

- Whether the top app bar keeps a dedicated cats toggle once the Settings popover also carries one, or whether the bar's toggle is dropped on wide screens too. Both surfaces present the same single preference (spec: "Show one appearance choice through every control that presents it"), so removing one later is a presentational edit that changes no requirement.
- Whether the workspace element ever becomes a real switcher in practice. The shell renders one as soon as two installations are known, but enumerating a user's installations needs a live GitHub call or a stored membership set, neither of which exists (see `src/app/page.tsx`'s note). Until some change supplies that list, the static label is the only reachable state, and nothing here needs to change when it arrives.
- Whether a future settings surface graduates from a popover to a page once change 3 adds source connections. The spec describes a settings surface, not its form factor.
