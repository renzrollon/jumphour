## 1. Dependencies and test environment

Owns `package.json`, the lockfile, `vitest.config.ts`.

- [x] 1.1 Re-resolve the current registry version of `jsdom`, `@testing-library/react`, `@testing-library/dom`, and `@testing-library/user-event` and add all four to `devDependencies` pinned literally (expected `30.1.0`, `16.3.3`, `10.4.2`, `14.6.7` per design.md Decision 5; if the registry has moved, update `package.json` and that table in the same commit), and verify `npm install` succeeds, the lockfile is committed, and no `^`, `~`, or `latest` appears anywhere in `package.json`
- [x] 1.2 Leave `vitest.config.ts` at `environment: "node"` and add one component test carrying the `// @vitest-environment jsdom` docblock that renders a trivial component with Testing Library and drives it with `user-event`, and verify `npm test` runs that file and the existing `renderToStaticMarkup` suites green in one run
- [x] 1.3 Add a repository test asserting every version string in `dependencies` and `devDependencies` is an exact pin and that `@testing-library/jest-dom`, `@vitejs/plugin-react`, Storybook, and Playwright are absent, and verify the test fails when a caret range is introduced

## 2. Appearance preference core

Owns `src/lib/appearance/appearance.ts` and its test. Framework-free: no `react`, no `next/*`, no `src/server` import.

- [x] 2.1 Implement `parseAppearance()` returning `{ theme: "system" | "light" | "dark"; cats: "on" | "off" }` by exact-match on the cookie tokens with per-field defaults (`light`, `off`), and verify unit tests cover every valid token, an absent cookie, `"midnight"`, an empty value, a large arbitrary string, `"Dark"`, `" dark"`, `"dark "`, and one invalid field beside one valid field (invalid theme + valid `cats=on` yields `light` + `on`)
- [x] 2.2 Implement the appearance cookie serializer writing only canonical tokens with `SameSite=Lax`, `Path=/`, a one-year max age, and no `httpOnly` flag, and verify a test asserts each attribute and that a non-canonical input value can never be serialized
- [x] 2.3 Add a test asserting this module imports nothing from `react`, `next/*`, or `src/server`, and verify it fails if such an import is added

## 3. Tokens, fonts, and the global stylesheet

Owns `src/app/tokens.css`, `src/app/globals.css`, `src/app/fonts.ts`, and their tests.

- [x] 3.1 Write `tokens.css` with the prototype's token names and values (design.md Decision 1) — light on bare `:root`, dark under both `@media (prefers-color-scheme: dark) { :root:not([data-jh-theme="light"]) }` and `:root[data-jh-theme="dark"]` — and verify a test parses the file and asserts the two dark blocks define exactly the same token-name set as `:root`, with no name defined in only one presentation
- [x] 3.2 Add a contrast test that reads the token values from `tokens.css` and asserts, for both presentations, at least 4.5:1 for body ink, secondary ink, metadata ink, accent ink, and each semantic tone against the surfaces they are used on, and at least 3:1 for borders, focus indicator, and tone dots, and verify the test names the failing pair when a value is changed below the floor
- [x] 3.3 Write `globals.css` with the box-sizing reset, base sans/mono families bound to the font variables, link and `:focus-visible` defaults with an offset outline, a `@media (prefers-reduced-motion: reduce)` block that neutralizes animation and transition, and a `@media (pointer: coarse)` rule giving interactive controls a 44px minimum activation area, and verify a test asserts all four rules are present and that the coarse-pointer rule does not alter the drawn size at fine pointers
- [x] 3.4 Write `fonts.ts` declaring Instrument Sans and JetBrains Mono through `next/font/google` with `system-ui, sans-serif` and `ui-monospace, monospace` fallbacks exported as CSS-variable classes, and verify `npm run typecheck` passes and a test asserts no module other than `src/app/layout.tsx` imports it

## 4. Root layout

Owns `src/app/layout.tsx` and its test. Depends on groups 2 and 3.

- [x] 4.1 Import `tokens.css` and `globals.css`, apply the font variable classes to `<html>`, read the two cookies through `parseAppearance()`, stamp `data-jh-theme` only for an explicit `light`/`dark` choice and `data-jh-cats="on"` only when cats is on, and verify a test renders the layout across all six theme/cats combinations and asserts the attribute matrix, including that `system` stamps no `data-jh-theme` at all
- [x] 4.2 Add a repository test asserting no `.ts`/`.tsx` file computes a resolved theme — no `matchMedia`, no `prefers-color-scheme`, no `resolvedTheme` identifier outside `tokens.css` — and verify it fails when such a reader is introduced (design.md invariant sweep, "Resolved theme")

## 5. UI primitives and the single overlay implementation

Owns `src/app/components/ui/**`. Depends on groups 1 and 3. Runs parallel with group 4.

- [x] 5.1 Implement the shared overlay core (focus trap, focus restoration, Escape with an opt-in `closeGuard`, outside-click dismissal, scroll lock, innermost-first Escape resolution), and verify jsdom tests cover each behavior directly against the core before any primitive wraps it
- [x] 5.2 Build `Dialog` (centered modal) and `Sheet` (right-side modal) on that core, and verify tests that focus enters on open, Tab and Shift+Tab wrap inside, content behind is unreachable, Escape closes and restores focus to the invoking control, Escape is refused while `closeGuard` is set and the working state stays visible, and a removed invoker restores focus to the nearest surviving container rather than the document body
- [x] 5.3 Build `Popover` and `Menu` on the same core, and verify tests that the invoker is marked expanded, Escape and an outside click each dismiss (the outside click activating nothing and changing nothing), Escape restores focus to the invoker, Up/Down move with wrapping and Home/End jump to the ends, Enter activates and closes, opening a second transient surface closes the first, and Escape inside a menu nested in a dialog closes only the menu
- [x] 5.4 Build `SegmentedControl` as a roving-tabindex radiogroup, and verify tests that it is a single tab stop with exactly one checked option, arrow keys move the choice and wrap at both ends, Tab leaves the group entirely, and an unrecognized current value still lets focus land on the first option and a choice be made
- [x] 5.5 Build `Button`, `IconButton`, `Switch`, `TextField`, `TextArea`, `Select`, `Banner`, `Badge`, `Skeleton`, and the icon set, and verify tests that `IconButton` cannot be constructed without an accessible name (type-level requirement plus a rendered-name assertion) and that every icon, tone dot, and illustration renders hidden from assistive technology
- [x] 5.6 Build `SourceBadge` over a closed source-kind union rendering exactly `GitHub`, `GitLab`, `Jira · MCP`, and `Manual`, and verify a test asserts the four labels, that the source accent is applied only within the badge element, and that the badge remains identifiable when its accent class is stripped
- [x] 5.7 Give `Skeleton` and the in-progress indicator a static, text-accompanied presentation under reduced motion, and verify a test asserts the loading state is still announced and visible with animation suppressed

## 6. Session, installation, and user reads plus sign-out

Owns `src/server/db/installations.ts`, `src/server/db/users.ts`, `src/server/db/sessions.ts`, `src/app/api/session/signout/route.ts`, and their tests. No migration: columns already exist in `migrations/0001_core_schema.sql`.

- [x] 6.1 Add `getInstallation(driver, installationId): { installationId: number; accountLogin: string } | undefined` selecting `github_installation_id, account_login` in portable ANSI SQL through the existing driver interface, and verify tests for a stored row and for an unknown id returning `undefined`
- [x] 6.2 Add `getUser(driver, githubUserId): { githubUserId: number; login: string } | undefined` selecting `github_user_id, login` the same way, and verify tests for a stored row and for an unknown id returning `undefined`
- [x] 6.3 Add `deleteSession(driver, sessionId): boolean` returning whether a row was removed, and verify tests that a live session is deleted and no longer readable through `getSession`, that an unknown id returns `false` without throwing, and that no other session row is affected
- [x] 6.4 Implement the sign-out route as a `POST` that deletes the session row, expires the session cookie, and responds `303` to `/`, and verify tests that it is idempotent for a missing or unknown session cookie, that the response clears the cookie in every case, and that a recording fetch stub proves no GitHub request is made

## 7. Sign-in landing

Owns `src/app/api/github/oauth/callback/route.ts` and `route.test.ts`. Depends on nothing else in this change.

- [x] 7.1 Replace the success branch's JSON body with a `303` to `/` carrying the session cookie, leaving the refresh branch's existing redirect untouched, and verify a test asserts the status, the `Location`, and the `Set-Cookie`
- [x] 7.2 Replace the failure branch's JSON body with a `303` to `/?signin=failed` that sets no session cookie, and verify a test asserts no session cookie is set and that neither the body, the headers, nor the `Location` contains the authorization code, a token, the client id, or the internal failure reason
- [x] 7.3 Rewrite each existing assertion in `route.test.ts` one-for-one against the redirect rather than deleting it — denied sign-in creates no session, a thrown code exchange does not produce a 500, a refresh round trip still re-lists and returns to the surface — and verify the rewritten suite still covers every fact the JSON assertions covered

## 8. Application shell

Owns `src/app/components/shell/**` (including the appearance server action) and its tests. Depends on groups 2, 5, and 6.

- [x] 8.1 Build the top app bar composing mark and wordmark, workspace element, search slot, theme control, cats toggle, settings entry, and account menu in fixed order, and verify a test asserts each appears exactly once and that the bar stays fixed while content scrolls
- [x] 8.2 Render the workspace element from `getInstallation()` — the account login as a static label with one known installation, a switcher naming each account with two or more — and verify tests that a session with no installation and a session naming an unstored installation both render the neutral "No installation" label, and that no numeric identifier and no invented workspace name is ever rendered
- [x] 8.3 Build the account menu from `getUser()` showing the GitHub login with a neutral label when the row is missing, offering only the sign-out form posting to the sign-out route, and verify tests assert the login, the neutral fallback, the absence of any numeric identifier, and that the menu contains no administration, billing, or credential item
- [x] 8.4 Build the theme control and cats toggle over a server action that writes the appearance cookies and revalidates, and verify tests that each control reflects the server-read preference, that a change is visible without a client-side theme computation, and that with cats on the visible option labels change while the accessible names stay "System theme", "Light theme", and "Dark theme"
- [x] 8.5 Build the settings popover containing appearance and cats only, with the description "Adds subtle cat accents without changing the board." bound to the toggle, and verify tests assert both sections are present, that their selections match the top-bar controls, and that the popover contains no token, password, connection, billing, or team-administration control
- [x] 8.6 Add the responsive collapse below 760px in the shell's module CSS, keeping the settings entry and account menu in the bar and both preferences reachable through settings, and verify tests assert the media-query rules exist, that a long account login truncates while its full value stays available, and that the bar neither scrolls horizontally nor overlaps its controls at any width

## 9. Signed-in and signed-out surfaces inside the shell

Owns `src/app/page.tsx`, `src/app/components/repository-table.tsx`, `installation-picker.tsx`, `sign-in-link.tsx` and their module CSS. Depends on groups 8 and 7.

- [x] 9.1 Render the signed-in surface inside the shell, passing the installation and user labels, without changing which repository rows are selected, the empty-state copy, or the Refresh form's target, and verify the existing `repository-table` and `installation-picker` tests still pass unchanged and a new test asserts no Idea / OpenSpec change / In progress / PR/MR column string appears anywhere in the rendered shell
- [x] 9.2 Render the signed-out view in the shell's visual system with the single GitHub sign-in action, the "GitHub OAuth is not configured" explanation when no client id is present, and a fixed non-secret notice when `?signin=failed` is present, and verify tests for all three states, including that the failure notice renders no code, token, client id, or internal reason text
- [x] 9.3 Restyle the three existing presentational components with module CSS without changing their markup contracts or exported props, and verify their existing test suites pass unedited (including the unsupported/permission-blocked suite that asserts no `<button>` and no `<a>` appears in those rows)

## 10. Preview gating

Owns `src/server/env.ts`, `src/app/dev/ui/preview-guard.ts`, `src/app/dev/ui/page.tsx`, `src/app/dev/ui/fixtures/**`, and their tests. Depends on group 5.

- [x] 10.1 Add `uiPreviewEnabled: boolean` to `Env`, true only when `JUMPHOUR_UI_PREVIEW` is exactly `"1"`, and verify a test asserts `"1"` is true and unset, empty, `"0"`, `"true"`, and `"yes"` are all false
- [x] 10.2 Implement the preview guard that responds as not found when previews are disabled, and verify a test asserts it triggers the not-found path for a disabled environment and returns normally for an enabled one
- [x] 10.3 Build `/dev/ui` as a primitives-and-shell index calling the guard as its first statement, exhibiting every primitive in both presentations with a persistent "Preview — fixture data" label, and verify tests that the page responds as not found with the flag unset and renders with the label when it is set
- [x] 10.4 Add a test that enumerates `src/app/dev/ui/**/page.tsx` and fails when any page does not call the guard, and verify it fails against a deliberately unguarded temporary page
- [x] 10.5 Add a test asserting no file under `src/server/` and no production route or page imports from `src/app/dev/ui/fixtures`, and verify it fails when such an import is added

## 11. Cross-cutting conformance

Owns `src/app/components/shell/*.conformance.test.tsx` and the repository-level guard tests. Depends on groups 8, 9, and 10.

- [x] 11.1 Add a cats-invariance test rendering the shell and the signed-out view with cats off and on, and verify it asserts an identical control set and order, identical accessible names, identical instructional and error copy, and identical spacing classes, with differences confined to decorative accents and the two theme-option visible labels
- [x] 11.2 Add a not-color-alone test over every tone-bearing primitive asserting each tone indicator is accompanied by text naming the state, and verify two states sharing one tone still render distinct text
- [x] 11.3 Add a test asserting the prototype fixture strings `Platform delivery`, `Priya Nair`, and the `acme/` sample repositories appear in no production module — only under `src/app/dev/ui/fixtures/` and in test files — and verify it fails when a fixture name is pasted into a shell or page module

## 12. Verification

- [x] 12.1 Run `npm test` and verify the whole suite passes, including the rewritten callback tests, the jsdom component tests, and every guard test from groups 10 and 11
- [x] 12.2 Run `npm run typecheck` and verify `tsc --noEmit` reports no error
- [ ] 12.3 Walk the running app once — sign in, change theme across System/Light/Dark with the OS set to dark, toggle cats, open settings, narrow the window past 760px, sign out, reload signed out, then request `/dev/ui` with and without `JUMPHOUR_UI_PREVIEW=1` — and verify no wrong-theme flash on any reload, no horizontal scrolling, settings and account reachable at every width, and a not-found response for the preview index when the flag is unset
