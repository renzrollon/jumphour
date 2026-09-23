## Why

The workflow board can select a card, put that selection in the URL, and highlight it — and then nothing opens. Everything that makes a derived board trustworthy lives one level below the card: the captured source snapshot, the evidence trail that explains why a card sits in the lane it sits in, the permalink back to the source, and the honest statement that Jumphour never writes back. Alongside it, the operational truth — which sources are reachable, which snapshots are stale, which lane listener is delayed — has no surface at all today, so a failed read is indistinguishable from an empty board.

Why now: `workflow-board-ui` lands the selection contract and the view-model vocabulary these panels read, and the production provider currently reports zero cards and zero connected sources. Building the panels while there is nothing to show forces them to render "no sources are connected" from real data, rather than inheriting the prototype's fixture sources.

## What Changes

- Add a **card detail view** opened by the board's existing selection: a side panel that retains board context on desktop, full-screen on small screens, dismissed by Escape or Close with focus returned to the originating card, and reachable by the board's `?card=<id>` deep link.
- Render the **source snapshot** (description, acceptance context, labels) as visually distinct, strictly untrusted plain text. Markup, script, and instruction-shaped text in a snapshot are displayed as literal characters, never executed or interpreted. A read-only note states that Jumphour never writes back to the source; a manual idea gets the local-record variant instead.
- Gate every link that originates from source data through an **http/https allow-list**. Any other scheme renders as plain text, not as a link. External links open in a new tab without opener access. Manual ideas show "Created in Jumphour" and no fabricated external link.
- Render the **evidence timeline** that explains the current derived placement, including the lane's listener line from the single listener formatter, and say plainly when there is no session evidence. The timeline never claims completion, approval, or a status change.
- Render **action slots from view-model availability only** — available enables, unavailable disables with a visible reason, absent renders nothing. "Start spec/ship with Claude Code" is primary; "Create OpenSpec without agent" is lower emphasis. Activating an available action emits an intent and nothing else; the dialogs it will open are a later change.
- Add a **non-destructive overflow menu**: Copy link (the in-app deep link), Open source, and Hide from board labelled "Local view only. Source is not changed." No source-mutation action exists anywhere in the panel.
- Make **Hide from board** local per browser and per installation, reversible through a visible "N hidden · Show all" affordance, and degrade to session-only hiding when browser storage is unavailable. Hidden ids never cross installations.
- Add a **source health panel** listing each connected source with a text-labeled badge, scope, status text plus a non-color indicator, a summary line, and detail — distinguishing healthy, stale snapshot, listener delay, and unreachable/fetch failure — plus every lane's listener state in lane order using the same formatter as the lane headers. With zero connected sources it says so and invents none.
- Add a **source status banner** naming the failing source and its last successful snapshot time while existing cards stay visible, with the distinct Jira-via-MCP copy and its `Retry Jira source` / `View connection details` actions. No login, OAuth, or credential-setup UI is offered anywhere.
- Add a status-only **"Source connections"** section and an **"Open source health"** entry to the Settings popover, and enforce one side panel at a time: opening source health closes detail, and opening detail closes source health.
- Add a `/dev/ui/panels` preview reproducing the prototype's `source-error` and `jira-failed` scenarios from fixtures behind the existing preview guard.

Out of scope: the compose, launch, and promote dialogs (change 4); the board, its lanes, filters, and card anatomy (change 2); design tokens, primitives, overlays, and the app shell (change 1); any listener, projection, inbox, or session-evidence backend; any snapshot sanitizer or persistence on the data side; and any change to the source connection itself — this change never connects, authenticates, or configures a source.

## Capabilities

### New Capabilities

- `card-detail`: Opening, dismissing, and deep-linking a selected card's detail view; its source header and permalink; the untrusted source-snapshot block and read-only note; safe rendering of source-originated links; the metadata grid with explicit absence placeholders; the evidence timeline that explains derived placement without claiming completion; action slots rendered from availability; the non-destructive overflow menu; and local, reversible, per-installation hiding.
- `source-health`: The source health panel's per-source rows and status vocabulary; the lane listener list; the source status banner including the distinct Jira-via-MCP failure copy; availability-gated retry; the honest zero-sources state; and the Settings popover's status-only source list plus its entry point, under a one-side-panel-at-a-time rule.

### Modified Capabilities

- None. This change adds two new capabilities and modifies no existing requirement. The board capability that owns selection and the shell capability that owns the Settings popover are both introduced by earlier unarchived changes in this set, so this change consumes their outputs and describes that consumption in `design.md` rather than editing their specs.

## Impact

Depends on `design-system-and-app-shell` (overlay behavior, Sheet/Popover/Menu/Banner/Badge/SourceBadge primitives, Settings popover, preview guard, `JUMPHOUR_UI_PREVIEW`) and on `workflow-board-ui` (`CardViewModel`, `BoardViewModel`, selection state and the `?card=` parameter, lane identity and copy, source presentation, the listener formatter, and relative-time formatting). Both are assumed present exactly as the shared integration brief names them.

Affected code: new `src/lib/board/safe-href.ts`, `src/lib/board/card-detail-view-model.ts`, and `src/lib/board/source-health-view-model.ts`; new `src/app/components/detail/` and `src/app/components/sources/`; a new section inside the shell's existing Settings popover; new `src/app/dev/ui/panels/page.tsx` with its own fixtures; and the board screen, which mounts the panels and consumes the hidden-card set when it builds lane lists and counts. The production board provider gains `sourceHealth = { sources: [], banner: null }` and leaves `detail` absent, because there are no cards to carry it.

No new dependency, no dependency version change, no SQL, no migration, no GitHub call, and no new environment variable. Local hiding uses per-browser storage keyed by installation and is never persisted server-side. `npm test` and `npm run typecheck` must stay green.
