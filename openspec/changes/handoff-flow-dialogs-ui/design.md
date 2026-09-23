## Context

See `proposal.md` — Why. This is change 4 of the four that port the Claude Design board prototype (`Jumphour Board prototype review/Jumphour Board.dc.html`) into the Next.js app. Changes 1–3 supply the overlay primitives and form controls, the board view model and its production provider, and the card detail panel whose action slots this change fills. The shared integration brief (`.claude/handoff/explore-claude-design-ui-integration.md`) fixes the stack, file layout, view-model names, and honesty rules for all four; this design does not re-decide them.

Three constraints dominate the approach:

- **Nothing behind these surfaces exists.** There is no idea-intake write path, no Claude Code embedding, no Interlock detection, no promotion writer. The epic puts them in its Changes 2–4. So the flows must be specified and built as presentation with a clean seam, and must be visibly inert until that seam is connected.
- **CLAUDE.md: zero GitHub writes.** The promote dialog describes a branch, a commit, and a pull request, and creates none of them.
- **The prototype lies in three specific places** (brief, "Prototype defects"): it simulates preflight with `setTimeout`, prints a fabricated CLI transcript (lines 772–774), and hard-codes the promotion pull request as `#491` (line 611). Porting its component logic verbatim would ship those lies.

Behavioral contracts: `specs/compose-idea-dialog/spec.md`, `specs/launch-session-sheet/spec.md`, `specs/promote-dialog/spec.md`.

## Goals / Non-Goals

**Goals:**

- Three surfaces whose entire visible state is a function of props, so every state in the spec is reachable in a unit test without a timer, a network call, or a fake clock.
- One place that decides whether a flow may open, consuming the board's `Availability` rather than re-deriving eligibility.
- One canonical change name feeding the branch, every previewed path, and the requested pull-request title.
- A running-session region that renders host content or admits it has none.
- A preview gallery that reproduces the prototype's launch and promote outcome matrix without letting a single fixture reach a production module.

**Non-Goals:**

- Any backend: no intake write, no CLI host, no preflight probe, no promotion writer, no session record.
- Re-specifying the overlay mechanics (focus trap, focus restoration, scroll lock, outside click) — change 1 owns the single overlay implementation; this change only says when dismissal is refused.
- Re-specifying card eligibility, lane derivation, source badges, relative time, or safe-link policy — changes 2 and 3 own those and this change consumes them.
- Deciding whether the three omitted prototype compose fields should exist as data. That is the intake change's call (Open Questions).

## Decisions

### 1. Controlled components with pure reducers; no component owns a timer

Every flow surface takes its complete state as a prop and emits events. No flow component holds a `setTimeout`, drives its own progression, or infers an outcome. The state shapes and the transitions live as framework-free pure functions under `src/lib/flows/`:

| Module | Owns |
| --- | --- |
| `src/lib/flows/flow-controller.ts` | `FlowController`, `FlowEntryState`, `flowEntryState()` |
| `src/lib/flows/compose-form.ts` | `ComposeValues`, `ComposeState`, `isBlank()`, `parseSupportingLinks()`, `validateCompose()` |
| `src/lib/flows/launch-session.ts` | `LaunchSheetState`, `PreflightCheckId`, `PREFLIGHT_CHECKS`, `PreflightStatus`, `applyPreflightResult()` |
| `src/lib/flows/launch-copy.ts` | `LaunchErrorKind`, `LAUNCH_ERROR_COPY`, `commandForCardKind()` |
| `src/lib/flows/change-name.ts` | `canonicalChangeName()`, `isValidChangeName()`, `derivePromoteTargets()` |
| `src/lib/flows/promote.ts` | `PromoteDialogState`, `PROMOTE_STEPS`, `PromoteStepStatus`, `applyPromoteProgress()` |

`src/lib/` is framework-free by the brief's file layout: no React, no `next/*`, no `src/server` imports. That makes the hard parts — whitespace and link parsing, name normalization, skip-after-failure, step statuses — testable as plain functions, and it keeps the components thin enough that their tests assert rendering and events only.

**Why:** the specs are almost entirely about which state is showing and what text it carries. A reducer makes each state a value you can construct; a component that owns progression makes each state something you must wait for. It also removes the prototype's whole class of bug where an outcome is decided by whichever timer fired last (`runLaunch`, lines 727–735).

**Rejected:** porting the prototype's `Component` class shape, where `runLaunch()` and `startPromote()` schedule their own state transitions — untestable without fake timers and structurally unable to accept a real backend later. **Rejected:** a `useReducer` per component with the reducer defined inside the component file — same logic, but not reachable from a test or from the preview simulator without rendering.

### 2. `FlowController` injection on the board screen; production passes none

```ts
export interface FlowController {
  compose?: ComposeHandler;
  launch?: LaunchHandler;
  promote?: PromoteHandler;
}
```

All three members are optional. An absent member means that flow cannot open. A new flow-host component (`src/app/components/flows/flow-host.tsx` — the repository names component files in kebab-case) owns which flow is open and renders the three surfaces; the board screen composes it and supplies the entry controls into the slots changes 2 and 3 already expose. `src/app/page.tsx` renders the board **without** a controller.

The gate is one function, used by every entry point:

```ts
flowEntryState(availability, handler)  // → { enabled: true } | { enabled: false; reason: string }
```

It returns `enabled: false` when availability is `unavailable` (carrying the provider's own `reason` verbatim) **or** when the handler is absent (carrying a "not connected on this surface" reason). Two conditions, one reader, no entry point deciding for itself.

Production today therefore fails both halves: the board provider reports `compose` and the per-card actions `unavailable`, and `page.tsx` supplies no controller. Every entry point renders disabled with a visible reason; no dialog can open.

**Why:** the honest state is "this does not work yet", and it should be impossible to reach the flows in production by accident. Making the handler's presence part of the gate means a half-wired deploy fails closed rather than opening a dialog whose submit goes nowhere.

**Rejected:** a feature flag or environment switch — a second source of truth alongside `Availability`, and one that can be flipped on while no handler exists. **Rejected:** mounting the dialogs with stubbed no-op handlers so the UI "works" — that is exactly the fabrication the brief's honesty rule forbids; a compose dialog that accepts a title and saves nothing is worse than a disabled button. **Rejected:** a single required `FlowController` with three required members, which would force stubs for the two flows a later change has not yet connected.

### 3. The running phase is a host-supplied slot, not a transcript

`LaunchSheetState` in its `running` variant carries `cliContent: ReactNode | null` supplied by the launch handler. The sheet renders it verbatim inside the session region. When it is `null` — or a string that is empty after trimming — the sheet renders the explicit "CLI unavailable" state instead.

The prototype's transcript (lines 772–774) is reproduced **only** as a preview fixture, in `src/app/dev/ui/fixtures/flows.ts`, beside the gallery's persistent "Preview — fixture data" label.

**Why:** brief rule 5 and the design prompt both forbid fabricated agent output. A slot also happens to be the correct seam for the real thing: whatever eventually embeds Claude Code hands back a node, and this component does not change.

**Rejected:** porting the templated transcript with real card values interpolated — it would print a plausible `Claude Code v1.0` banner and an `interlock:spec` echo for a command that never ran, which is indistinguishable from a real session to the person reading it. **Rejected:** rendering an empty terminal-styled box when no content exists — a dark monospace panel with a blinking cursor reads as "connected and idle", so the empty case gets its own labelled state rather than an absence of text.

### 4. Working directory is supplied per repository, never derived

The launch sheet's working directory comes from the repository options the launch handler provides (`{ repository: RepositoryRef; workingDirectory: string }`), keyed by `githubRepoId`. The UI never constructs a path from a repository name. With no handler there are no options and the sheet cannot open, so production shows no directory at all.

**Why:** the prototype hard-codes `REPO_DIR` (line 650) mapping `acme/*` to `~/src/acme/*`. That mapping is a property of the machine running the CLI, not of the repository, and inventing it is the same category of error as inventing a transcript. It is also the value the "Working directory matches selected repository" check compares against — deriving it in the UI would make that check compare a string to itself.

**Rejected:** deriving `~/src/<full_name>` in the UI. **Rejected:** a user-editable working-directory field — the design prompt's mismatch failure exists precisely because the directory is detected, not chosen.

### 5. Compose is spec-first: three prototype fields are dropped

The compose dialog's fields are Title (required), Problem / opportunity (required → `description`), and Supporting links (optional). The prototype's **Context and constraints**, **Repository** (required), and **Suggested owner** are not rendered.

This is the brief's recorded conflict resolution: the locked manual-idea schema in `mcp-inboxes-and-idea-snapshots` (`idea-intake` → "Create a manual idea", and that change's Assumptions) requires title + description, allows optional links, and explicitly has no repository and no owner/assignee field. The epic's non-goals forbid assignees outright. A UI that collects a value the store has nowhere to put either drops it silently or forces a schema change from the front end.

**Why:** the store is the contract. Adding a field here would either lose the user's typing or pre-empt a data-model decision that belongs to the intake change.

**Rejected:** rendering the three fields and discarding their values on submit. **Rejected:** rendering Repository as optional "so the prototype still matches" — the intake spec says manual ideas do not carry a repository at all, and an optional field that is always ignored is a lie with extra steps. Whether any of the three should become real data is deferred to Open Questions.

### 6. The simulated controller lives only under `src/app/dev/ui/`

`src/app/dev/ui/flows/simulated-controller.ts` implements `FlowController` with the prototype's timers and outcome matrix, and `src/app/dev/ui/flows/page.tsx` selects an outcome from the query string, mirroring the prototype's props enum (line 649):

- `?launch=success|unavailable|no-interlock|mismatch|active-session` — failing at preflight index 0, 1, 3 and 4 respectively, with the remaining checks `skipped`, exactly as the prototype's `failAt` map does.
- `?promote=success|branch-exists` — `branch-exists` failing on step 2, `Creating branch`.

The page calls the preview guard itself and 404s unless `JUMPHOUR_UI_PREVIEW=1`, per change 1. Change 1's preview structure tests (their contract is change 2's `ui-preview-gallery` spec) already fail any `src/app/dev/ui/**/page.tsx` that omits the guard and any `src/server/` or production-route import of `src/app/dev/ui/fixtures`. This change adds a third assertion: nothing under `src/app/components/flows/` or `src/lib/flows/` imports from `src/app/dev/ui/`.

**Why:** the simulator is the only thing in this change that behaves like a backend, and it is the thing most likely to be reached for when someone wants the dialogs to "work". Keeping it under the preview tree, off by default everywhere including development, makes that reach visible in a diff.

**Rejected:** a shared `createMockFlowController()` under `src/lib/flows/` for reuse in tests — it would sit one import away from production code. Tests construct the states they need directly, which is what Decision 1 makes cheap.

### 7. Dismissal is refused while a flow is committed

Change 1's overlay owns Escape, backdrop click, focus trap and restoration. This change supplies one predicate per surface saying when dismissal is refused:

| Surface | Dismissal refused while | Left by |
| --- | --- | --- |
| Compose dialog | a submission is in flight | Cancel, or Escape/backdrop once resolved |
| Launch sheet | the session is `running` | "Exit session" only |
| Promote dialog | the `progress` step is showing | its explicit Close control |

This follows the prototype's own `escape()` and `overlayClick()` rules (lines 707–715, 817) — the one part of its dialog handling that was right — and adds the focus trap and focus restoration the prototype lacked (brief, change 1).

**Why:** each refusal marks a point where a stray Escape would lose entered values, abandon an attended session, or make the user believe they cancelled work that is still happening. In every case the surface still offers an explicit way out, so nothing is trapped.

**Rejected:** blocking dismissal whenever any flow is open — Escape closing an untouched configure step is correct and expected. **Rejected:** a confirm-before-closing prompt, which adds a second dialog to a change whose whole subject is dialogs.

### 8. This change adds nothing to the platform

No new dependency (change 1 pinned the interactive-component test infrastructure; nothing here needs more). No SQL, no migration. No GitHub call — not a read, and certainly not the branch, commit, or pull request the promote dialog describes. No API route, no server action, no file under `src/server/`. A test asserts that no module under `src/app/components/flows/` or `src/lib/flows/` imports `src/server/` or performs `fetch`.

**Why:** it makes the review question trivial — a diff touching `package.json`, `src/server/`, a `.sql` file, or `src/app/api/` is out of scope for this change by construction.

## Invariant sweep — shared and derived values

Values this change **owns** (normalize once; every reader consumes the canonical form):

| Value | Canonical form | Computed where | Readers |
| --- | --- | --- | --- |
| Canonical change name | lowercase; Unicode-normalized with accents folded; runs of non-`[a-z0-9]` → single `-`; leading/trailing `-` removed; first four hyphen words | `canonicalChangeName()` in `change-name.ts` | change-name input default, target branch, all three previewed paths, requested PR title, branch-exists error copy, "Choose a different name" round trip |
| Target branch | `spec/<canonical name>` | `derivePromoteTargets()` | Configure branch row, error copy naming the branch, success branch row when the result echoes it |
| Previewed artifact paths | `openspec/changes/<canonical name>/proposal.md`, `…/tasks.md`, `…/specs/…` | `derivePromoteTargets()` | Configure file preview only (success shows the result's links) |
| Requested pull-request title | `Add OpenSpec change: <canonical name>` | `derivePromoteTargets()` | the emitted promote intent. The **displayed** success title is the result's, never this |
| Change-name validity | non-empty, `[a-z0-9]` separated by single `-`, alphanumeric at both ends | `isValidChangeName()` | create-action enabled state, inline format guidance |
| Command per card kind | `interlock:spec` for `idea`, `interlock:ship` for `openspec-change` | `commandForCardKind()` in `launch-copy.ts` | command preview, primary action label, "Interlock is not installed" body, running-phase note, active-session summary |
| Preflight checks and order | `PREFLIGHT_CHECKS` — the five labels, in the prototype's order (line 684) | `launch-session.ts` | check list render, `applyPreflightResult()` skip-after-failure, preview simulator's `failAt` indices |
| Preflight status vocabulary | `not checked` \| `checking` \| `ok` \| `failed` \| `skipped`, each rendered as text | `launch-session.ts` | each check row; no color- or glyph-only status anywhere |
| Launch failure copy | `LAUNCH_ERROR_COPY` keyed by `LaunchErrorKind`, title + body, command interpolated from `commandForCardKind()` | `launch-copy.ts` | the four failure states and their recovery actions |
| Promote step list and statuses | `PROMOTE_STEPS` (four labels, in order); `waiting` \| `in progress` \| `done` \| `failed` | `promote.ts` | progress list, failed-step marking, step label "Step 2 of 3 · …" |
| Flow entry enablement | `{enabled} \| {enabled:false, reason}` from `Availability` **and** handler presence | `flowEntryState()` in `flow-controller.ts` | Compose idea control, Start spec, Start ship, Promote control |
| Compose blankness | `isBlank()` — trim over all Unicode whitespace | `compose-form.ts` | Title and Problem / opportunity required checks |
| Supporting links | split on line breaks and commas, drop blanks, keep order, accept only `http:`/`https:`, name rejects | `parseSupportingLinks()` | link field validation, rejected-entry report, emitted compose intent |

Values this change **reads** and must not re-derive (owner in brackets):

| Value | Canonical form | Where this change reads it |
| --- | --- | --- |
| Source presentation [2] | `sourcePresentation()` → label + badge variant | compose footer Manual badge, launch sheet card header, promote idea header |
| Repository identity [1 of the epic, surfaced by 2] | `githubRepoId`; `fullName` is display only | launch repository select, promote repository select, working-directory option key, emitted intents. Never a `fullName` string compare |
| Action availability [2 for compose, 3 for per-card actions] | `Availability` with the provider's own `reason` | every entry point, through `flowEntryState()` |
| Safe link [3] | `toSafeLink()` http/https allow-list | promote success pull-request link and artifact links |
| Card kind / lane [2] | `laneId` from the provider | input to `commandForCardKind()`; never derived from the card's contents |
| Freshness and relative time [2] | `formatRelativeTime(iso, generatedAt)` | snapshot reference lines in the launch sheet and promote header |

## Risks / Trade-offs

- **[Three dead entry points in production]** → Board, detail, and toolbar will each show a disabled control with a reason, and a reviewer may read that as broken. Mitigation: the reason string comes from the provider and names the missing backend ("Idea intake is not enabled for this installation yet."); the specs make the disabled state a required behavior, not an accident.
- **[Cross-change seam]** → This change fills slots owned by changes 2 and 3 while all four are authored in parallel; slot prop names could drift. Mitigation: the seam is one optional prop (`flows?: FlowController`) on the board screen plus rendered nodes into existing slots; the wiring is its own task group, sequenced after every other implementation group, so a rename is one file. That group is the only one permitted to edit a file owned by changes 1–3, and it may add only the optional prop and the composition — no behavioral edit to a board or detail component.
- **[Change-name normalization surprises a user]** → Folding accents and truncating to four words can produce a name the user did not expect. Mitigation: the suggestion is always editable, the derived branch and paths update live from the edited value, and an invalid name is reported rather than silently repaired.
- **[Fixture leakage]** → The prototype transcript and `acme/*` repositories are exactly the material someone would reach for to make a screenshot look full. Mitigation: the guard and fixture-import structure tests from change 1, plus this change's assertion that nothing in `components/flows/` or `lib/flows/` imports the preview tree.
- **[Simulator diverges from the real backend]** → The preview simulator may encode behaviors the eventual handler cannot provide. Mitigation: the simulator implements the same `FlowController` interface and nothing else; anything it needs that the interface lacks is a design bug, caught at the type level.
- **[Promote copy implies Jumphour writes]** → The dialog says it creates a branch and opens a pull request, while this change performs no write. Mitigation: it emits an intent and cannot open in production; the copy describes what the eventual handler will do, and the dialog shows only what a handler reports.

## Migration Plan

- **Deploy:** ship with the board. Nothing to configure. `JUMPHOUR_UI_PREVIEW` stays unset, so `/dev/ui/flows` 404s. All three entry points render disabled with the provider's reason.
- **Rollback:** remove `FlowHost` from the board screen. No data, no schema, no external state to undo.
- **Forward:** the epic's Change 2 (intake) supplies `compose`, its Change 3 supplies `launch` with repository/working-directory options and real preflight results, its Change 4 supplies `promote`. Each connects one optional member and flips its `Availability` to `available`; no flow component changes. Later work MUST keep reading `Availability` rather than re-deriving eligibility, and MUST keep deriving the branch, previewed paths, and requested pull-request title from `canonicalChangeName()` rather than re-normalizing the title.

## Open Questions

- **The three omitted compose fields.** Should **Context and constraints**, **Repository**, or **Suggested owner** become real manual-idea data? This is a data-model question for `mcp-inboxes-and-idea-snapshots`, whose locked schema is title + description + optional links and whose Assumptions already record the omission. Context and constraints is the plausible one — it is free text with nowhere to go today. Repository contradicts "import without a repository is allowed" (epic Q13) and Suggested owner contradicts the epic's no-assignees non-goal, so both would need those decisions reopened first. Answering this later adds a field and a scenario; it does not change this change's approach or task breakdown.
- **Whether the requested pull-request title is the right contract.** `Add OpenSpec change: <name>` comes from the prototype. The promotion writer may want provenance in the title or prefer to compose it itself, in which case `derivePromoteTargets()` stops feeding that field and the emitted intent carries only idea, repository, and name. Deferrable: the displayed title already comes from the result.
- **Where repository working directories come from.** This change takes them from the launch handler's options. Whether the eventual CLI host discovers them, stores them per workspace, or asks once is that change's decision; the slot shape does not depend on the answer.
