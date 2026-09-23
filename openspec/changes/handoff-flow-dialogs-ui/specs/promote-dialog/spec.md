## Purpose

Presents the optional non-agent path from one idea to an OpenSpec change as a lower-emphasis three-step dialog that previews exactly what will be created, reports progress in text, shows results from the reported outcome rather than invented values, and recovers from a failed branch or pull request.

## ADDED Requirements

### Requirement: Present a lower-emphasis Configure step for a non-agent OpenSpec change

The system SHALL present the non-agent path as a dialog titled "Create OpenSpec change without agent", visibly lower in emphasis than the attended Claude Code launch action, and SHALL label its first step "Step 1 of 3 · Configure".

The Configure step SHALL show the selected idea with its source badge, title, and immutable snapshot reference, and SHALL offer a repository selector over the installation's repositories identified by canonical repository identifier, plus a change-name input carrying the inline guidance "Lowercase, hyphen-separated, verb first." It SHALL show the derived target branch, a file preview listing `proposal.md`, `tasks.md`, and a `specs/…` entry under `openspec/changes/<change-name>/`, and the result note "This creates files on a GitHub branch and opens a pull request. It does not update the original issue."

#### Scenario: Happy path — Configure previews branch, files, and consequence
- **GIVEN** a selected idea with a captured snapshot, in an installation with repositories
- **WHEN** the user opens the promote dialog
- **THEN** the dialog title reads "Create OpenSpec change without agent" and the step label reads "Step 1 of 3 · Configure"
- **AND** the selected idea's source badge, title, and snapshot reference are shown
- **AND** a repository selector, a change-name input, and the guidance "Lowercase, hyphen-separated, verb first." are shown
- **AND** the target branch and the three previewed artifact entries under `openspec/changes/<change-name>/` are shown
- **AND** the note "This creates files on a GitHub branch and opens a pull request. It does not update the original issue." is shown

#### Scenario: Failure — no repository is available to promote into
- **GIVEN** a selected idea in an installation whose repository list is empty
- **WHEN** the user opens the promote dialog
- **THEN** the dialog states that no repository is available
- **AND** the create action is disabled
- **AND** no branch or file preview is presented as if it were about to be created

#### Scenario: Edge case — promote stays visibly secondary to the attended launch
- **GIVEN** a selected Idea card whose attended launch action and promote action are both available
- **WHEN** the user views the card's actions
- **THEN** the attended launch action is presented as the primary action
- **AND** the promote action is presented at lower emphasis
- **AND** both remain reachable by keyboard with distinct accessible names

### Requirement: Derive one canonical change name and use it for every derived value

The system SHALL derive a suggested change name from the selected idea's title by exactly one normalization: apply Unicode normalization and fold accented letters to their base letter, lowercase the result, replace each run of characters that are not lowercase letters or digits with a single hyphen, remove leading and trailing hyphens, and keep at most the first four hyphen-separated words.

The canonical change name is the user's edited value when they edit it, and the suggested value otherwise. The target branch SHALL be `spec/<canonical name>`, every previewed artifact path SHALL sit under `openspec/changes/<canonical name>/`, and the pull-request title requested on creation SHALL be derived from that same canonical name. All of these MUST always agree; no derived value may be computed from the raw idea title or from a separately normalized copy.

#### Scenario: Happy path — a suggested name drives branch and paths together
- **GIVEN** a selected idea titled `Support request-level idempotency keys`
- **WHEN** the promote dialog opens
- **THEN** the suggested change name is `support-request-level-idempotency`
- **AND** the target branch reads `spec/support-request-level-idempotency`
- **AND** the previewed files read `openspec/changes/support-request-level-idempotency/proposal.md`, `openspec/changes/support-request-level-idempotency/tasks.md`, and a `specs/…` entry under the same directory

#### Scenario: Failure — a title with no alphanumeric content yields no name
- **GIVEN** a selected idea titled `— … ///`
- **WHEN** the promote dialog opens
- **THEN** the change-name input is empty rather than containing hyphens or a placeholder word
- **AND** the create action is disabled
- **AND** no branch or artifact path is shown as derivable

#### Scenario: Edge case — casing, whitespace, punctuation, and accents resolve to one name
- **GIVEN** a selected idea titled `  ...Give FINANCE Éxport   Failures/Retries — an actionable path!!  `
- **WHEN** the promote dialog opens
- **THEN** the suggested change name is `give-finance-export-failures`
- **AND** the leading and trailing punctuation and whitespace produce no leading or trailing hyphen
- **AND** the runs of whitespace, slashes, and dashes each collapse to a single hyphen
- **AND** the accented `É` folds to `e` rather than becoming a hyphen
- **AND** the target branch, every previewed path, and the requested pull-request title all use exactly `give-finance-export-failures`

### Requirement: Block creation on an invalid change name

The system SHALL treat a change name as valid only when it is non-empty and consists of lowercase letters and digits separated by single hyphens, beginning and ending with a letter or digit. When the entered name is invalid the create action SHALL be disabled, the dialog SHALL show inline guidance associated with the change-name input explaining the required format, and no creation intent SHALL be emitted.

#### Scenario: Happy path — a valid name enables creation
- **GIVEN** an open Configure step with the change name `add-idempotency-keys`
- **WHEN** the user reads the dialog
- **THEN** the create action is enabled
- **AND** no format error is shown
- **AND** the target branch reads `spec/add-idempotency-keys`

#### Scenario: Failure — an invalid name is reported inline and blocks creation
- **GIVEN** an open Configure step
- **WHEN** the user types `Add Idempotency Keys!`
- **THEN** the create action is disabled
- **AND** an inline message associated with the change-name input explains the lowercase, hyphen-separated format
- **AND** activating the create action emits no creation intent

#### Scenario: Edge case — hyphen-boundary names are rejected without silent repair
- **GIVEN** an open Configure step
- **WHEN** the user types `-add--keys-`
- **THEN** the name is reported invalid because of its leading hyphen, doubled hyphen, and trailing hyphen
- **AND** the dialog does not silently rewrite the entry into a valid name
- **AND** clearing the field to empty is also reported invalid rather than falling back to the suggested name

### Requirement: Show creation progress in text without implying an agent

While creation is in progress the system SHALL label the step "Step 2 of 3 · Creating artifacts" and SHALL show exactly these four steps in order — Validating change name, Creating branch, Writing OpenSpec artifacts, Opening GitHub pull request — each with a text status drawn from `waiting`, `in progress`, `done`, `failed`. Status changes SHALL be announced politely, not assertively.

The progress step SHALL state that the dialog can be closed and that progress continues, and the dialog SHALL remain closable during progress if the host's creation continues independently of the dialog. The copy MUST NOT describe an agent as working, reasoning, or deciding; this flow creates files and opens a pull request.

#### Scenario: Happy path — four steps advance with text statuses
- **GIVEN** a creation in progress that has completed the first two steps
- **WHEN** the user reads the progress step
- **THEN** the step label reads "Step 2 of 3 · Creating artifacts"
- **AND** Validating change name and Creating branch each read `done`
- **AND** Writing OpenSpec artifacts reads `in progress` and Opening GitHub pull request reads `waiting`
- **AND** each status is present as text, not as color or a spinner alone

#### Scenario: Failure — the copy never claims an agent is doing the work
- **GIVEN** a creation in progress
- **WHEN** the user reads every visible string in the progress step
- **THEN** none of them describe an agent working, thinking, planning, or deciding
- **AND** the step names describe file and pull-request creation only
- **AND** the dialog does not present a transcript, prompt, or model indicator

#### Scenario: Edge case — closing during progress does not cancel or falsely confirm
- **GIVEN** a creation in progress
- **WHEN** the user closes the dialog
- **THEN** the dialog states before closing that progress continues and the board will reflect the result from repository evidence
- **AND** closing emits no cancellation and no success
- **AND** while progress is being shown, Escape and a backdrop click do not dismiss the dialog; only the explicit close control does

### Requirement: Present the success step from the reported result

On success the system SHALL label the step "Step 3 of 3 · Done" and SHALL show the created branch, the pull request's number, title, and external link, and links to the created artifacts — each taken from the reported creation result. The dialog MUST NOT display a hard-coded pull-request number, title, or link, and MUST NOT display a link whose scheme is anything other than `http` or `https`.

The success step SHALL state "Derived placement: OpenSpec change. The original issue was not modified." and SHALL offer "View OpenSpec change" and "Return to board".

#### Scenario: Happy path — result values are displayed as reported
- **GIVEN** a creation that reports branch `spec/add-idempotency-keys`, pull request number `#517` titled `Add OpenSpec change: add-idempotency-keys` at an `https` link, and three artifact links
- **WHEN** the success step is shown
- **THEN** the step label reads "Step 3 of 3 · Done"
- **AND** the branch, `#517`, the reported title, and the reported link are shown
- **AND** the three artifact links are shown
- **AND** the note "Derived placement: OpenSpec change. The original issue was not modified." is shown
- **AND** "View OpenSpec change" and "Return to board" are offered

#### Scenario: Failure — a result missing pull-request facts shows their absence
- **GIVEN** a creation that reports a created branch but no pull-request number or link
- **WHEN** the success step is shown
- **THEN** the branch is shown
- **AND** the dialog states that no pull request was reported
- **AND** it shows no pull-request number, title, or link of its own invention

#### Scenario: Edge case — a non-http result link is not rendered as a link
- **GIVEN** a creation result whose pull-request link uses a `javascript` scheme
- **WHEN** the success step is shown
- **THEN** that value is not rendered as an activatable link
- **AND** the pull-request number and title are still shown as text
- **AND** an `https` artifact link in the same result is still rendered as a link

### Requirement: Recover from a failed branch or pull-request creation

When creation fails the system SHALL label the step "Step 2 of 3 · Creation failed", mark the step that failed as `failed` in text, show the concrete reason reported for the failure, and state that the original issue has not changed. It SHALL offer "Choose a different name", which returns to the Configure step with the repository and change name intact and editable, and "Try again", which re-attempts creation with the current values.

The dialog MUST NOT present a failed creation as partially successful, and MUST NOT claim that any source issue, comment, label, or status was updated.

#### Scenario: Happy path — an existing branch is reported concretely with both recoveries
- **GIVEN** a creation for the change name `add-idempotency-keys` that fails because `spec/add-idempotency-keys` already exists
- **WHEN** the failure is shown
- **THEN** the step label reads "Step 2 of 3 · Creation failed"
- **AND** the message names `spec/add-idempotency-keys` and says a branch with that name already exists
- **AND** the copy states the original issue has not changed
- **AND** both "Choose a different name" and "Try again" are offered

#### Scenario: Failure — the failed step is identifiable in text
- **GIVEN** a creation that fails while opening the pull request
- **WHEN** the failure is shown
- **THEN** Validating change name, Creating branch, and Writing OpenSpec artifacts each read `done`
- **AND** Opening GitHub pull request reads `failed`
- **AND** the dialog does not show a success confirmation for the run

#### Scenario: Edge case — choosing a different name preserves the configuration
- **GIVEN** a failed creation with repository `acme/api-gateway` and change name `add-idempotency-keys`
- **WHEN** the user activates "Choose a different name"
- **THEN** the dialog returns to "Step 1 of 3 · Configure"
- **AND** the repository is still `acme/api-gateway` and the change name is still `add-idempotency-keys`, both editable
- **AND** editing the name to `add-idempotency-keys-v2` updates the target branch and every previewed path together
- **AND** no creation intent is emitted until the user activates the create action again

### Requirement: Emit promote intent to a handler and perform no write itself

The promote dialog SHALL perform no GitHub request of its own. Activating the create action SHALL emit the user's confirmed intent — selected idea, selected repository, and canonical change name — exactly once to a supplied handler, and every displayed outcome SHALL come from what that handler reports.

The system SHALL enable the promote entry point only when the card reports the promote action as `available` **and** a promote handler has been supplied. When either condition is unmet the entry point SHALL be disabled with a visible reason that is also available to assistive technology, and activating it SHALL open no dialog.

#### Scenario: Happy path — one activation emits one intent and issues no request
- **GIVEN** an open Configure step with a valid change name and a supplied promote handler
- **WHEN** the user activates the create action twice in rapid succession
- **THEN** exactly one creation intent is emitted, carrying the selected idea, the selected repository's canonical identifier, and the canonical change name
- **AND** the dialog itself issues no GitHub request
- **AND** the progress step is shown only because the handler reported that creation started

#### Scenario: Failure — an unavailable promote action shows the card's own reason
- **GIVEN** a selected idea whose promote action is unavailable with the reason "Promotion is not enabled for this installation yet."
- **WHEN** the user views the promote control
- **THEN** the control is disabled
- **AND** the reason "Promotion is not enabled for this installation yet." is visible and available to assistive technology
- **AND** activating it opens no dialog

#### Scenario: Edge case — available but no handler cannot open
- **GIVEN** a selected idea whose promote action is available
- **AND** no promote handler has been supplied
- **WHEN** the user activates the promote control
- **THEN** no dialog opens
- **AND** the control is disabled with a visible reason that promotion is not connected on this surface
- **AND** the same outcome holds when a handler is supplied but the card reports the action unavailable
