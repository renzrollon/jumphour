## Why

Changes 1–3 give Jumphour a shell, an evidence-derived board, and a card detail panel that renders *action slots* from availability — but every one of those slots is inert. The three surfaces that carry the product's actual handoff (compose a manual idea, start one attended Interlock command, create an OpenSpec change without an agent) exist only as a Claude Design prototype that fakes them: it simulates preflight with timers, prints an invented CLI transcript, hard-codes a pull-request number, and asks for a repository the locked manual-idea schema does not have. This change ports those three surfaces as honest, controlled components so the board's slots have something real to open the moment a backend change lands — and, until then, visibly cannot open at all.

## What Changes

- Add a **Compose idea dialog**: Title (required), Problem / opportunity (required), Supporting links (optional), Manual badge + "Created in Jumphour" footer, inline programmatically-associated validation, and a submitting state that disables dismissal. It has **no repository field and no owner field** — the locked manual-idea schema from `mcp-inboxes-and-idea-snapshots` wins over the prototype's required `Repository` / `Suggested owner`.
- Add a **Claude Code launch sheet** bound to exactly one card and one repository: snapshot reference, repository selector keyed by canonical repository identity, working directory, exact command preview (`interlock:spec` for an Idea, `interlock:ship` for an OpenSpec change plus its change path), five named preflight checks with per-check **text** status, and the four locked failure states with the design prompt's exact titles and copy.
- Make the launch sheet's **running phase a host-supplied region**. With nothing supplied it shows an explicit "CLI unavailable" state. It never renders a fabricated transcript, never claims the command completed, never moves a card, and offers only "Exit session" — no stop, queue, retry, approve, or schedule control.
- Add a **Promote dialog**: a lower-emphasis three-step "Create OpenSpec change without agent" flow — Configure (repository, change name with format guidance, derived `spec/<name>` branch, file preview, result note), Progress (four steps with text status, politely announced, closable while progress continues), Success (branch, PR number/title/link **from state**, artifact links, "The original issue was not modified"), and the recoverable branch/PR failure with "Choose a different name" and "Try again".
- Derive one **canonical change name** from the idea title by a single normalization, and derive the target branch, every previewed artifact path, and the pull-request title from that same canonical name.
- Introduce a **`FlowController` injection point** on the board screen. Each flow is a separate optional member; an absent member means that flow cannot open. **Production passes no controller**, and the production board provider already reports every flow action `unavailable`, so in production today each entry point renders disabled with its visible reason and no dialog opens.
- Reproduce the prototype's outcome matrix (`launch=success|unavailable|no-interlock|mismatch|active-session`, `promote=success|branch-exists`) in the preview gallery only, behind the existing preview guard.

Out of scope: manual-idea persistence, MCP adapters, Claude Code process embedding, Interlock command detection, working-directory probing, session records, GitHub branch/commit/pull-request writes, and any API route. This change performs **zero** GitHub calls, adds **zero** dependencies, adds **zero** SQL, and adds **zero** API routes. It states the user's intent and hands it to a handler that production does not supply.

## Capabilities

### New Capabilities

- `compose-idea-dialog`: A focused (not chat) compose surface for a manual idea — the spec-locked field set, inline validation including whitespace-only and non-http/https links, submitting/success/failure states, and availability gating of its entry point.
- `launch-session-sheet`: The attended one-card/one-repository Claude Code launch surface — command preview per card kind, the five-check preflight with text status and skip-after-failure, the four non-destructive failure states, the host-supplied running region, and the guarantee that the board does not change.
- `promote-dialog`: The lower-emphasis non-agent OpenSpec-change flow — Configure/Progress/Success/Error steps, canonical change-name derivation feeding branch and previewed paths, state-sourced pull-request facts, and recoverable failure.

### Modified Capabilities

- None. `compose-idea-dialog`, `launch-session-sheet`, and `promote-dialog` are new. This change **consumes** the in-flight `workflow-board` (compose availability, repositories, card kind), `card-detail` (per-action availability, snapshot reference, safe links), `design-system` (dialog/sheet overlay, form controls, badges), and `app-shell` capabilities without modifying any of them.

## Impact

Front-end only. Implementation adds flow state types and pure reducers under `src/lib/flows/`, three component families under `src/app/components/flows/`, one `FlowController` prop threaded from the board screen, and a `/dev/ui/flows` preview page with its own fixtures. No file under `src/server/` changes. No migration, no environment variable, no dependency (the interactive-component test infrastructure was pinned by `design-system-and-app-shell`).

**Assumptions:**

- This change depends on `design-system-and-app-shell`, `workflow-board-ui`, and `card-detail-and-source-health-ui`, and consumes their outputs exactly as the shared integration brief names them.
- **The manual-idea schema is title + description (required) plus optional links.** The prototype's `Context and constraints`, `Repository` (required), and `Suggested owner` fields are deliberately omitted; whether any of them becomes a real field is a data-model question for the intake change, recorded in `design.md` Open Questions.
- Repository options come from the installation's repositories and are identified by canonical repository id, never by comparing `owner/name` strings.
- Command strings are exactly `interlock:spec` and `interlock:ship`. The card kind that selects between them comes from the view model; the UI never derives eligibility.
- A flow's entry point is enabled only when the view model reports that action `available` **and** the host supplies a handler for it. Production satisfies neither today.
- The simulated controller that reproduces the prototype's launch and promote outcomes is fixture code and lives only under the preview gallery, which is off by default everywhere.

**Deferred:** real preflight probing, Claude Code embedding, session exclusivity enforcement, promotion idempotency and duplicate detection, and the "no session evidence observed yet" card annotation — all of which belong to the epic's Change 3 and Change 4 backends.
