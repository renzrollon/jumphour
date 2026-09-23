## Purpose

Presents the attended Claude Code launch as a sheet bound to exactly one card and one repository, showing the exact Interlock command, a readable preflight, the locked non-destructive failure states, and a session region supplied by the host rather than invented output.

## ADDED Requirements

### Requirement: Bind a launch sheet to exactly one card and one repository

The system SHALL open the launch sheet for exactly one selected card and SHALL bind it to exactly one repository at a time. The sheet SHALL carry the subtitle "Attended session · bound to one card and one repository" and SHALL show the selected card's source badge, title, source key, and immutable snapshot reference, plus the selected repository and the working directory that repository maps to.

Repository choices SHALL be the current installation's repositories, identified by their canonical repository identifier. The sheet MUST NOT identify, compare, or select a repository by its displayed `owner/name` text. It MUST NOT offer a way to launch for more than one card or more than one repository.

#### Scenario: Happy path — the sheet states its single card and repository binding
- **GIVEN** a selected Idea card sourced from GitHub issue `#814` with a captured snapshot
- **AND** an installation offering three repositories
- **WHEN** the user opens the launch sheet for that card
- **THEN** the sheet shows the card's source badge, title, source key `#814`, and its snapshot reference
- **AND** it shows the subtitle "Attended session · bound to one card and one repository"
- **AND** it shows one selected repository and the working directory for that repository
- **AND** it offers no control for adding a second card or a second repository to the launch

#### Scenario: Failure — no repository is available to bind
- **GIVEN** a selected card in an installation whose repository list is empty
- **WHEN** the user opens the launch sheet
- **THEN** the sheet states that no repository is available to launch in
- **AND** the primary action is disabled
- **AND** no working directory or command is presented as if it were runnable

#### Scenario: Edge case — repositories are matched by identity, not display text
- **GIVEN** an installation whose repository list contains one repository whose display name was recently renamed from `Acme/API-Gateway` to `acme/api-gateway` while keeping its canonical identifier
- **WHEN** the user opens the launch sheet with that repository pre-selected by canonical identifier
- **THEN** exactly one repository option is selected
- **AND** the selection survives the display-name change because it is keyed by canonical identifier
- **AND** no second option appears for the former display name

### Requirement: Preview the exact Interlock command for the selected card kind

The system SHALL show the exact command that will be run, taken from the card kind reported by the board: `interlock:spec` for an Idea, and `interlock:ship` for an OpenSpec change. For an OpenSpec change the sheet SHALL additionally show the change path that command targets. The primary action SHALL read "Open Claude Code and start spec" for an Idea and "Open Claude Code and start ship" for an OpenSpec change.

The sheet MUST NOT derive the command, or eligibility to launch, from anything other than the board's reported card kind and action availability. It MUST NOT offer any command other than these two, and MUST NOT substitute one for the other.

#### Scenario: Happy path — an Idea previews the spec command
- **GIVEN** a selected Idea card
- **WHEN** the user opens the launch sheet
- **THEN** the command preview reads `interlock:spec`
- **AND** the primary action reads "Open Claude Code and start spec"
- **AND** no OpenSpec change path is shown

#### Scenario: Failure — a change card without a change path cannot present a ship command
- **GIVEN** a selected OpenSpec change card whose change path is absent
- **WHEN** the user opens the launch sheet
- **THEN** the sheet states that the change path is missing
- **AND** the primary action is disabled
- **AND** it does not fall back to previewing `interlock:spec`

#### Scenario: Edge case — changing repository keeps the command and updates the directory
- **GIVEN** an open launch sheet for an OpenSpec change card named `add-idempotency-keys`, previewing `interlock:ship` and the change path `openspec/changes/add-idempotency-keys/`
- **WHEN** the user selects a different repository
- **THEN** the working directory changes to the newly selected repository's directory
- **AND** the command preview still reads `interlock:ship` and the change path is unchanged
- **AND** the primary action still reads "Open Claude Code and start ship"

### Requirement: Present five preflight checks, each with a text status

The system SHALL present exactly these five preflight checks, in this order:

1. Claude Code available on this workspace
2. Interlock command available in repository
3. Repository access
4. Working directory matches selected repository
5. No other Jumphour session running

Each check SHALL carry one text status drawn from: `not checked`, `checking`, `ok`, `failed`, `skipped`. Before a preflight run every check SHALL read `not checked`. Once a check reports `failed`, every later check SHALL read `skipped` and MUST NOT be presented as passing.

A check's status MUST be readable as text. It MUST NOT be conveyed by color, icon, glyph, or position alone.

#### Scenario: Happy path — all five checks pass in order
- **GIVEN** an open launch sheet whose preflight will succeed
- **WHEN** the user starts the launch
- **THEN** the five checks are listed in the specified order
- **AND** each check moves from `checking` to `ok` as it resolves
- **AND** every status is present as text beside its check label

#### Scenario: Failure — a failed check marks the remaining checks skipped
- **GIVEN** an open launch sheet whose second check "Interlock command available in repository" will fail
- **WHEN** the user starts the launch
- **THEN** check 1 reads `ok` and check 2 reads `failed`
- **AND** checks 3, 4, and 5 each read `skipped`
- **AND** no later check is reported as `ok`

#### Scenario: Edge case — statuses survive the removal of color and glyphs
- **GIVEN** an open launch sheet before any preflight has run
- **WHEN** the check list is read with all color and decorative glyphs ignored
- **THEN** each of the five checks still reads `not checked` in text
- **AND** after a run that fails on check 4, the same reading distinguishes `ok`, `failed`, and `skipped` without color

### Requirement: Report a launch prerequisite failure without changing the board

When preflight fails because Claude Code cannot be opened, or because the requested Interlock command is not installed in the selected repository, the system SHALL show the locked failure state for that case, announce it, and state or clearly imply that the board has not changed. Neither failure SHALL start a command, move a card, create a session, or alter any card's lane.

The `Claude Code is unavailable` state SHALL read "We can't open the embedded CLI on this workspace. The board has not changed." The `Interlock is not installed` state SHALL name the exact command that is missing for the selected card kind and SHALL read "`<command>` is unavailable in this repository. Install or configure Interlock, then try again."

#### Scenario: Happy path — Claude Code unavailable is reported verbatim and non-destructively
- **GIVEN** an open launch sheet whose first preflight check fails
- **WHEN** the preflight run completes
- **THEN** the sheet shows the title `Claude Code is unavailable`
- **AND** the body reads "We can't open the embedded CLI on this workspace. The board has not changed."
- **AND** the failure is announced to assistive technology
- **AND** the user is offered a way to try again and a way to return to the board
- **AND** no card has changed lane

#### Scenario: Failure — a missing ship command is named exactly
- **GIVEN** a selected OpenSpec change card
- **AND** a preflight run in which "Interlock command available in repository" fails
- **WHEN** the failure is shown
- **THEN** the title reads `Interlock is not installed`
- **AND** the body names `interlock:ship` as the unavailable command
- **AND** it does not name `interlock:spec`

#### Scenario: Edge case — the same failure names the spec command for an Idea
- **GIVEN** a selected Idea card
- **AND** the same failing preflight check
- **WHEN** the failure is shown
- **THEN** the body names `interlock:spec` as the unavailable command
- **AND** the wording is otherwise identical to the change-card case
- **AND** the command named always matches the command previewed in the same sheet

### Requirement: Report a blocked launch that needs a different selection or the active session

When preflight fails because the detected CLI working directory does not match the selected repository, or because a Jumphour Claude Code session is already running, the system SHALL show the locked failure state for that case and offer the matching recovery. Neither case SHALL run the command, queue it, schedule it, retry it automatically, or change the board.

The `Repository working directory mismatch` state SHALL show both the selected repository and the detected CLI directory, SHALL state that the command was blocked before running, and SHALL offer "Return to repository selection". The `A Jumphour Claude Code session is already running` state SHALL show the active session's bound card, repository, and command, SHALL offer "Open active session", and SHALL state that nothing was queued.

#### Scenario: Happy path — a mismatch shows both directories and offers a way back
- **GIVEN** an open launch sheet with repository `acme/api-gateway` selected
- **AND** a preflight run in which "Working directory matches selected repository" fails with the detected directory `~/src/acme/customer-web`
- **WHEN** the failure is shown
- **THEN** the title reads `Repository working directory mismatch`
- **AND** both the selected repository and the detected CLI directory `~/src/acme/customer-web` are shown as distinct labelled values
- **AND** the copy states the command was blocked before running
- **AND** a "Return to repository selection" action is offered

#### Scenario: Failure — an active session blocks the launch and is never queued
- **GIVEN** an active Jumphour Claude Code session bound to the card `MOB-77 Offline queue for shell telemetry`, the repository `acme/mobile-shell`, and the command `interlock:ship`
- **WHEN** the user's preflight fails on "No other Jumphour session running"
- **THEN** the title reads `A Jumphour Claude Code session is already running`
- **AND** the active session's card, repository, and command are shown
- **AND** an "Open active session" action is offered
- **AND** the copy states that nothing was queued
- **AND** the blocked launch is not started later on its own

#### Scenario: Edge case — returning to repository selection resets the preflight
- **GIVEN** a launch sheet showing the `Repository working directory mismatch` failure
- **WHEN** the user activates "Return to repository selection"
- **THEN** the sheet returns to its configuration state with the card binding unchanged
- **AND** all five preflight checks read `not checked` again
- **AND** the failure message is no longer shown
- **AND** no command has run

### Requirement: Render a running session only from host-supplied output

When a launch has started, the system SHALL show the bound repository, the working directory, a text indication that the session is active, a region whose entire contents are supplied by the host, and the note that Interlock governs the command and that the board updates only from repository, host, and linked session evidence.

The system MUST NOT render an invented, sample, or placeholder command transcript in that region. When the host supplies no content, or supplies only whitespace, the sheet SHALL show an explicit "CLI unavailable" state explaining that no session output is available on this surface.

#### Scenario: Happy path — host-supplied output is shown with its session context
- **GIVEN** a running launch whose host supplies session output
- **WHEN** the running phase is shown
- **THEN** the sheet shows the bound repository, the working directory, and a text indication that the session is active
- **AND** the host-supplied content is shown in the session region
- **AND** a note states that Interlock governs the command and that the board updates only from repository, host, and linked session evidence

#### Scenario: Failure — no host content shows CLI unavailable rather than invented output
- **GIVEN** a running launch whose host supplies no session content
- **WHEN** the running phase is shown
- **THEN** the session region shows an explicit "CLI unavailable" state
- **AND** it explains that no session output is available on this surface
- **AND** it contains no command prompt, no simulated command echo, and no sample output

#### Scenario: Edge case — whitespace-only host content is treated as none
- **GIVEN** a running launch whose host supplies content consisting only of line breaks and spaces
- **WHEN** the running phase is shown
- **THEN** the sheet shows the same explicit "CLI unavailable" state as when no content was supplied
- **AND** it does not present an empty dark region that could be mistaken for a live but idle terminal

### Requirement: Offer no session control beyond exiting, and block dismissal while running

While a session is running the system SHALL offer exactly one control over that session: exiting it. It MUST NOT offer stop, queue, retry, approve, schedule, route, model-selection, or any other session control. While running, the sheet MUST NOT be dismissible by the Escape key or by a click on the backdrop; it is left only through its explicit exit control.

#### Scenario: Happy path — only an exit control is offered
- **GIVEN** a running launch session
- **WHEN** the user reads the sheet's controls
- **THEN** the only session control is "Exit session"
- **AND** no stop, queue, retry, approve, schedule, or routing control is present
- **AND** the footer explains that exiting the CLI ends the session and that the card keeps its evidence-derived column

#### Scenario: Failure — Escape does not dismiss a running sheet
- **GIVEN** a running launch session
- **WHEN** the user presses Escape
- **THEN** the sheet stays open
- **AND** the session is not exited
- **AND** the same press dismisses the sheet once it is no longer running

#### Scenario: Edge case — the backdrop is inert while running but not while configuring
- **GIVEN** a running launch session
- **WHEN** the user clicks the backdrop outside the sheet
- **THEN** the sheet stays open
- **AND** a backdrop click while the sheet is still in its configuration state does dismiss it

### Requirement: Leave the board unchanged for the whole life of the sheet

The system SHALL NOT claim that a launched command started successfully, progressed, or completed, and SHALL NOT move a card between lanes, change a card's evidence, or mark work as done as a result of opening, running, or closing the launch sheet. Closing the sheet SHALL leave the board exactly as the board's own view model describes it.

#### Scenario: Happy path — closing after a run changes nothing
- **GIVEN** a board whose selected Idea card sits in the Idea lane
- **AND** a launch that was started and then exited
- **WHEN** the sheet closes
- **THEN** the card is still in the Idea lane
- **AND** its evidence text is unchanged
- **AND** the board matches its view model exactly

#### Scenario: Failure — the sheet never reports the command as finished
- **GIVEN** a running launch session whose host stops supplying content
- **WHEN** the user reads the sheet
- **THEN** it does not state that the command completed, succeeded, or failed
- **AND** it does not present a Jumphour-owned completion or approval state
- **AND** it continues to attribute governance of the command to Interlock

#### Scenario: Edge case — a failed preflight leaves the board identical to before
- **GIVEN** a board rendered from a view model
- **WHEN** the user opens the launch sheet, runs a preflight that fails, and closes the sheet
- **THEN** every lane's cards, counts, and evidence text are identical to before the sheet was opened
- **AND** no card was added, removed, or re-laned

### Requirement: Open the launch sheet only when the action is available and a handler exists

The system SHALL enable a launch entry point only when the card reports that launch action as `available` **and** a launch handler has been supplied to the board. When either condition is unmet the entry point SHALL be disabled, SHALL carry a visible reason that is also available to assistive technology, and activating it SHALL open no sheet.

When the card reports the action unavailable, the displayed reason SHALL be the reason the card supplied, not a substitute phrase invented by the sheet.

#### Scenario: Happy path — available with a handler opens the sheet
- **GIVEN** a selected Idea card whose start-spec action is available
- **AND** a launch handler has been supplied
- **WHEN** the user activates "Start spec with Claude Code"
- **THEN** the launch sheet opens bound to that card

#### Scenario: Failure — an unavailable action shows the card's own reason
- **GIVEN** a selected OpenSpec change card whose start-ship action is unavailable with the reason "Attended launches are not enabled for this installation yet."
- **WHEN** the user views the start-ship control
- **THEN** the control is disabled
- **AND** the reason "Attended launches are not enabled for this installation yet." is visible and available to assistive technology
- **AND** activating it opens no sheet

#### Scenario: Edge case — available but no handler cannot open
- **GIVEN** a selected Idea card whose start-spec action is available
- **AND** no launch handler has been supplied
- **WHEN** the user activates "Start spec with Claude Code"
- **THEN** no sheet opens
- **AND** the control is disabled with a visible reason that attended launch is not connected on this surface
- **AND** the same outcome holds when a handler is supplied but the card reports the action unavailable
