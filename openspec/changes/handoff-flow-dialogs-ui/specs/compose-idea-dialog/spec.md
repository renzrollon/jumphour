## Purpose

Lets a signed-in user capture a decision-worthy manual idea in a focused compose dialog that collects exactly the locked manual-idea fields, reports validation inline, and never opens unless composing is actually available.

## ADDED Requirements

### Requirement: Present a focused compose dialog for a manual idea

The system SHALL present manual idea composition as a focused dialog, not a chat or free-text prompt surface. The dialog SHALL be labelled `Compose idea`, SHALL carry the helper copy "Capture a decision-worthy idea. Promotion will create an OpenSpec change; it will not start implementation.", and SHALL offer exactly three inputs: **Title** (required), **Problem / opportunity** (required), and **Supporting links** (optional). Its footer SHALL show a `Manual` source badge beside the text "Created in Jumphour".

The dialog MUST NOT present a repository field or an owner/assignee field, and MUST NOT require a repository selection in order to submit. The required inputs MUST be marked as required to assistive technology, not by a visual asterisk alone.

#### Scenario: Happy path — the dialog offers only the locked manual-idea fields
- **GIVEN** a signed-in user on the board with composing available
- **WHEN** they open Compose idea
- **THEN** the dialog shows a Title input, a Problem / opportunity input, and a Supporting links input
- **AND** it shows the helper copy "Capture a decision-worthy idea. Promotion will create an OpenSpec change; it will not start implementation."
- **AND** its footer shows a Manual badge and the text "Created in Jumphour"
- **AND** Title and Problem / opportunity are exposed as required to assistive technology

#### Scenario: Failure — no repository or owner can be supplied
- **GIVEN** an open compose dialog
- **WHEN** the user looks for a repository selector or an owner/assignee selector
- **THEN** neither control exists in the dialog
- **AND** submitting with Title and Problem / opportunity filled is accepted without any repository being chosen
- **AND** the submitted idea carries no repository and no owner

#### Scenario: Edge case — the dialog opens with empty inputs and no pre-existing error
- **GIVEN** a user who previously opened compose, typed a title, and cancelled
- **WHEN** they open Compose idea again
- **THEN** all three inputs are empty
- **AND** no validation error is shown before the first submission attempt
- **AND** focus is placed inside the dialog on the Title input

### Requirement: Reject a compose submission that is missing a required field

The system SHALL refuse to submit a manual idea when Title or Problem / opportunity is empty. For each missing required field it MUST show an inline error that is programmatically associated with that field, announced when it appears, and reachable by assistive technology — not conveyed by border color alone. The Title error text SHALL be "Add a title so the idea is recognizable on the board."

Input consisting only of whitespace MUST count as empty. Whitespace for this purpose includes any Unicode whitespace, not only the space character.

#### Scenario: Happy path — a missing title blocks submission and is reported inline
- **GIVEN** an open compose dialog with an empty Title and a filled Problem / opportunity
- **WHEN** the user activates the primary action
- **THEN** no idea is submitted
- **AND** an inline error reading "Add a title so the idea is recognizable on the board." is shown and is programmatically associated with the Title input
- **AND** the Title input is marked invalid to assistive technology
- **AND** the entered Problem / opportunity text is unchanged

#### Scenario: Failure — a missing problem statement is reported on its own field
- **GIVEN** an open compose dialog with a filled Title and an empty Problem / opportunity
- **WHEN** the user activates the primary action
- **THEN** no idea is submitted
- **AND** an inline error is associated with the Problem / opportunity input, not with the Title input
- **AND** the error identifies which field is missing rather than reporting a generic form failure

#### Scenario: Edge case — whitespace-only input counts as empty
- **GIVEN** an open compose dialog whose Title contains only whitespace characters, including a non-breaking space, a tab, and an ideographic space
- **AND** whose Problem / opportunity contains a single ordinary space
- **WHEN** the user activates the primary action
- **THEN** both fields are treated as empty and no idea is submitted
- **AND** both fields show their inline required error
- **AND** a Title of `  Retry finance exports  ` with surrounding whitespace is instead accepted and submitted with the surrounding whitespace removed

### Requirement: Accept supporting links only when they are http or https URLs

The system SHALL accept zero or more supporting links entered as free text, separated by line breaks, commas, or a mixture of both. Empty entries produced by consecutive separators MUST be discarded without comment.

A link SHALL be submitted only when its scheme is `http` or `https`. An entry with any other scheme, or one that is not a URL at all, MUST be reported to the user as rejected and named in that report; it MUST NOT be silently dropped, silently rewritten to add a scheme, or submitted. Supporting links are optional: a submission with no links MUST be accepted.

#### Scenario: Happy path — mixed separators produce one link per entry
- **GIVEN** an open compose dialog with a valid Title and Problem / opportunity
- **AND** a Supporting links value containing `https://example.test/a` and `http://example.test/b` on separate lines and `https://example.test/c` after a comma
- **WHEN** the user submits
- **THEN** exactly three supporting links are submitted, in the order entered
- **AND** no other field is affected

#### Scenario: Failure — a non-http link is named and blocks nothing silently
- **GIVEN** an open compose dialog with valid required fields
- **AND** a Supporting links value containing `https://example.test/a` and `javascript:alert(1)` and `mailto:someone@example.test`
- **WHEN** the user submits
- **THEN** the dialog reports that `javascript:alert(1)` and `mailto:someone@example.test` were not accepted because only http and https links are supported
- **AND** the report names the rejected entries rather than stating only that some links were invalid
- **AND** no rejected entry is submitted

#### Scenario: Edge case — separators, blanks, and an empty field
- **GIVEN** an open compose dialog with valid required fields
- **AND** a Supporting links value of `https://example.test/a,,\n \n,https://example.test/a`
- **WHEN** the user submits
- **THEN** the empty entries produced by the consecutive separators and the whitespace-only line are discarded without an error
- **AND** the two remaining identical links are both submitted, because de-duplication is not part of this dialog's behavior
- **AND** submitting with the Supporting links field left completely empty is accepted with zero links

### Requirement: Hold the compose dialog while a submission is in flight

While a compose submission is in flight the system SHALL disable the primary action, announce it as busy to assistive technology, and keep every entered value visible and unchanged. While in flight the dialog MUST NOT be dismissible by the Escape key or by a click on the backdrop, and MUST NOT accept a second submission.

#### Scenario: Happy path — the submitting state is disabled and announced
- **GIVEN** an open compose dialog with valid required fields
- **WHEN** the user activates the primary action and the submission has not yet resolved
- **THEN** the primary action is disabled and announced as busy
- **AND** its label states that the idea is being saved
- **AND** the entered Title, Problem / opportunity, and Supporting links values remain visible and editable state is not cleared

#### Scenario: Failure — Escape does not dismiss a dialog that is submitting
- **GIVEN** a compose dialog with a submission in flight
- **WHEN** the user presses Escape
- **THEN** the dialog stays open
- **AND** the submission continues
- **AND** once the submission resolves with an error, a later Escape press dismisses the dialog normally

#### Scenario: Edge case — a double activation submits exactly once
- **GIVEN** an open compose dialog with valid required fields
- **WHEN** the user activates the primary action twice in rapid succession
- **THEN** exactly one submission is made
- **AND** a click on the backdrop while that submission is in flight does not dismiss the dialog

### Requirement: Report the outcome of a compose submission

On a successful submission the system SHALL close the dialog and report the created idea's identifier to the surface that opened it, so that surface can select or reveal the new idea. On a failed submission the dialog SHALL stay open with every entered value intact and SHALL show a visible, announced error describing the failure. A failed submission MUST NOT be presented as a saved idea, and MUST NOT clear the form.

#### Scenario: Happy path — success closes the dialog and reports the new idea
- **GIVEN** an open compose dialog with valid required fields
- **WHEN** the submission succeeds and returns the identifier `idea-4821`
- **THEN** the dialog closes
- **AND** `idea-4821` is reported to the surface that opened the dialog
- **AND** focus returns to the control that opened the dialog

#### Scenario: Failure — a rejected submission keeps the dialog and its values
- **GIVEN** an open compose dialog whose Title is `Compare hosted runners against the overnight queue`
- **WHEN** the submission fails
- **THEN** the dialog stays open
- **AND** the Title still reads `Compare hosted runners against the overnight queue` and the other entered values are unchanged
- **AND** a visible error explains the failure and is announced to assistive technology
- **AND** no idea identifier is reported to the surface that opened the dialog

#### Scenario: Edge case — retrying after a failure submits the same values once
- **GIVEN** a compose dialog showing a submission failure with its values intact
- **WHEN** the user activates the primary action again without editing anything
- **THEN** exactly one new submission is made carrying the same values
- **AND** the previous error is cleared while that submission is in flight

### Requirement: Open compose only when it is available and a handler exists

The system SHALL enable the Compose idea entry point only when the board reports composing as `available` **and** a compose handler has been supplied to the board. When either condition is unmet the entry point SHALL be disabled, SHALL carry a visible reason that is also available to assistive technology, and activating it SHALL open no dialog.

When the board reports composing unavailable, the displayed reason SHALL be the reason the board supplied, not a substitute phrase invented by the dialog.

#### Scenario: Happy path — available with a handler opens the dialog
- **GIVEN** a board that reports composing as available
- **AND** a compose handler has been supplied
- **WHEN** the user activates Compose idea
- **THEN** the compose dialog opens

#### Scenario: Failure — unavailable shows the board's own reason
- **GIVEN** a board that reports composing unavailable with the reason "Idea intake is not enabled for this installation yet."
- **WHEN** the user views the Compose idea entry point
- **THEN** the control is disabled
- **AND** the reason "Idea intake is not enabled for this installation yet." is visible and available to assistive technology
- **AND** activating the control opens no dialog

#### Scenario: Edge case — available but no handler cannot open
- **GIVEN** a board that reports composing as available
- **AND** no compose handler has been supplied
- **WHEN** the user activates Compose idea
- **THEN** no dialog opens
- **AND** the control is disabled with a visible reason that composing is not connected on this surface
- **AND** the same outcome holds when a handler is supplied but the board reports composing unavailable
