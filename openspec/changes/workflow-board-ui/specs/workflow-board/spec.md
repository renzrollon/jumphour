## Purpose

Presents a team's work as a fixed Idea → OpenSpec change → In progress → PR/MR board whose contents are a read-only projection of evidence, so people can see where intent really is without maintaining a second, manually moved tracker.

## ADDED Requirements

### Requirement: Present a fixed four-lane projection board

The system SHALL present the signed-in landing view as exactly four lanes in the fixed order Idea, OpenSpec change, In progress, PR/MR, each with a title, a derived-evidence sublabel, and a card count. The board MUST NOT offer any way to move a card between lanes, reorder lanes, rename lanes, or set a card's status. It SHALL provide an explanation of the derived lifecycle that states placement is calculated from evidence, that cards cannot be dragged or set manually, and that Jumphour never writes to a source.

#### Scenario: Happy path — four lanes in fixed order
- **GIVEN** a signed-in user whose session is bound to a GitHub App installation
- **WHEN** they open the signed-in landing view
- **THEN** they see four lanes titled Idea, OpenSpec change, In progress, and PR/MR, in that order
- **AND** each lane shows its sublabel ("Captured, not yet promoted", "Branch and change artifacts exist", "Implementation evidence is active", "Host review is open or ready") and a card count

#### Scenario: Happy path — derived lifecycle explanation
- **GIVEN** the board is displayed
- **WHEN** the user activates "How column placement works"
- **THEN** an explanation states "Column placement is calculated from source, OpenSpec, session, and PR/MR evidence."
- **AND** it lists the four lanes in board order with the evidence that places a card in each
- **AND** it states that cards cannot be dragged or set manually and that Jumphour never writes to a source

#### Scenario: Failure — no installation is bound to the session
- **GIVEN** a signed-in user whose session has no GitHub App installation
- **WHEN** they open the signed-in landing view
- **THEN** no lanes and no cards are shown
- **AND** the view explains that a GitHub App installation is required and links to the repository view

#### Scenario: Edge case — a user tries to place a card manually
- **GIVEN** a board with a card in the Idea lane
- **WHEN** the user attempts to drag that card onto another lane, or looks for a status control on the card
- **THEN** the card has no drag affordance and no status control
- **AND** the card remains in the Idea lane

### Requirement: Render the board only from provider-derived state

The system SHALL render each card's lane, each lane's listener state, and every action's availability exactly as derived by the board's data provider. The interface MUST NOT infer or recompute a lane, a listener state, or an availability from a card's text, source, or any other displayed field.

#### Scenario: Happy path — card appears in the derived lane
- **GIVEN** the provider derives a card into In progress with evidence "Cursor session · implementation file activity · observed 3 min ago"
- **WHEN** the board is displayed
- **THEN** the card appears in the In progress lane with that evidence text
- **AND** the In progress count includes it

#### Scenario: Failure — the provider cannot produce a board
- **GIVEN** a signed-in user bound to an installation
- **WHEN** the provider fails to read stored data
- **THEN** the view shows that the board could not be loaded and offers a retry
- **AND** it does not show cards from an earlier render, sample cards, or an empty board that implies there is no work

#### Scenario: Edge case — displayed text disagrees with the derived lane
- **GIVEN** the provider derives a card into OpenSpec change
- **AND** that card's evidence text mentions "PR #488 (draft)"
- **WHEN** the board is displayed
- **THEN** the card appears in OpenSpec change
- **AND** it does not appear in PR/MR

### Requirement: Show a truthful listener state on every lane

Every lane header SHALL show that lane's listener state in text. The interval line ("Listening every N min") MUST appear only when the provider reports a configured listener. A lane with no configured listener SHALL say so. A delayed or failing listener SHALL be distinguishable from a healthy one by its text, not by color alone. Durations MUST be computed against the board's generation time and MUST NOT be negative.

#### Scenario: Happy path — healthy listener
- **GIVEN** a lane whose listener is configured at 5 minutes and last heard 2 minutes before the board was generated
- **WHEN** the board is displayed
- **THEN** the lane header reads "Listening every 5 min" and "Last heard 2 min ago"

#### Scenario: Failure — delayed listener
- **GIVEN** a lane whose listener is configured, is retrying, and last succeeded 14 minutes before the board was generated
- **WHEN** the board is displayed
- **THEN** the lane header states that listening is delayed and that the last successful listen was 14 min ago
- **AND** the delayed state is conveyed by the words, with color only as reinforcement

#### Scenario: Edge case — no listener is configured
- **GIVEN** an installation for which no lane listener exists
- **WHEN** the board is displayed
- **THEN** every lane header reads "Listener not configured"
- **AND** no lane header shows "Listening every" or a last-heard time

#### Scenario: Edge case — configured listener has never succeeded
- **GIVEN** a lane whose listener is configured at 5 minutes and has no successful listen
- **WHEN** the board is displayed
- **THEN** the lane header reads "Listening every 5 min" and "Not heard yet"

#### Scenario: Edge case — last-heard time is later than the generation time
- **GIVEN** a lane whose last-heard time is 40 seconds after the board's generation time
- **WHEN** the board is displayed
- **THEN** the lane header reads "Last heard just now"
- **AND** it does not show a negative or future duration

### Requirement: Offer manual reads only on the Idea and PR/MR lanes

The system SHALL offer "Load ideas" on the Idea lane header and in the board toolbar, and "Fetch PRs/MRs" on the PR/MR lane header. The OpenSpec change and In progress lanes MUST NOT show a manual read, refresh, or status control. A manual read control SHALL be enabled only when the provider reports it available; when unavailable it SHALL be disabled and show the provider's reason in visible text. Manual read menus MUST describe the action as an immediate read that never writes back.

#### Scenario: Happy path — Load ideas is available
- **GIVEN** the provider reports Load ideas available with GitHub Issues, GitLab issues, Jira, and Manual inbox options
- **WHEN** the user opens Load ideas
- **THEN** the menu lists those options with text labels, marking GitHub, GitLab, and Jira as read via MCP
- **AND** it states "Reads the selected source now and captures snapshots. Never writes back."
- **AND** choosing an option requests exactly that read

#### Scenario: Happy path — Fetch PRs/MRs is available
- **GIVEN** the provider reports Fetch PRs/MRs available
- **WHEN** the user opens Fetch PRs/MRs on the PR/MR lane
- **THEN** the menu offers GitHub pull requests and GitLab merge requests
- **AND** it states "Read-only MCP fetch. No comments, reviews, or labels."

#### Scenario: Failure — manual read is unavailable
- **GIVEN** the provider reports Load ideas unavailable with reason "Idea intake is not enabled for this installation yet."
- **WHEN** the board is displayed
- **THEN** Load ideas is disabled in both the toolbar and the Idea lane header
- **AND** the reason is visible as text without hovering
- **AND** activating the disabled control requests nothing and opens no menu

#### Scenario: Edge case — middle lanes never get a manual control
- **GIVEN** a provider result that, in error, includes a manual read for the In progress lane
- **WHEN** the board is displayed
- **THEN** the In progress and OpenSpec change lane headers show no manual read, refresh, or status control

### Requirement: Filter the board by repository, source, and owner

The system SHALL let a user narrow the board by repository, by source (All sources, GitHub, GitLab, Jira · MCP, Manual), and by owner. Repository filtering MUST match on the repository's GitHub-canonical identity, not on a displayed name, and MUST list only repositories of the current installation. Cards that are not bound to any repository MUST remain visible under a repository filter. Owner options SHALL be derived from the owners present on the board's cards plus a "No owner" option; when no card has an owner the owner filter MUST NOT be shown. Lane counts SHALL reflect the active filters.

#### Scenario: Happy path — filter to one repository
- **GIVEN** a board with cards bound to `acme/api-gateway`, cards bound to `acme/customer-web`, and an Idea card bound to no repository
- **WHEN** the user selects `acme/api-gateway` in the repository filter
- **THEN** every lane shows only the cards bound to `acme/api-gateway`, plus the unbound Idea card in the Idea lane
- **AND** each lane count equals the number of cards it now shows

#### Scenario: Failure — selected repository is no longer in the installation
- **GIVEN** the user has filtered to a repository
- **WHEN** the board is regenerated and that repository is no longer in the installation's repository list
- **THEN** the repository filter returns to "All repositories"
- **AND** the board does not show an empty result for a repository that can no longer be chosen

#### Scenario: Edge case — one repository under two display names
- **GIVEN** a repository renamed from `acme/gateway` to `acme/api-gateway`
- **AND** one card still displays the old name while another displays the new name, both carrying the same canonical repository identity
- **WHEN** the user filters to that repository
- **THEN** both cards are shown
- **AND** the repository filter lists that repository once, under its current name

#### Scenario: Edge case — no card has an owner
- **GIVEN** a board on which no card carries an owner
- **WHEN** the board is displayed
- **THEN** no owner filter is shown
- **AND** no card displays an owner or an "Unassigned" placeholder

#### Scenario: Edge case — combining filters
- **GIVEN** a board with Jira and GitHub cards across two repositories
- **WHEN** the user selects source "Jira · MCP" and one repository
- **THEN** only cards that satisfy both filters are shown

### Requirement: Search cards across all lanes

The system SHALL filter cards across all four lanes by a search query matched against each card's title, source key, change name, and evidence text. Matching MUST be insensitive to letter case, to leading, trailing, and repeated whitespace, and to Unicode compatibility forms. A query that is empty after normalization MUST be treated as no query.

#### Scenario: Happy path — query narrows every lane
- **GIVEN** a board with cards titled "Support request-level idempotency keys" in Idea and "Add idempotency keys to payment intents" in OpenSpec change
- **WHEN** the user searches for `idempotency`
- **THEN** both cards remain visible in their lanes and cards that do not match are hidden
- **AND** lane counts reflect the matches

#### Scenario: Failure — nothing matches
- **GIVEN** a populated board
- **WHEN** the user searches for a term no card contains
- **THEN** every lane shows its filtered-empty state with a "Reset filters" action
- **AND** activating "Reset filters" clears the query and restores every card

#### Scenario: Edge case — casing, whitespace, and Unicode forms resolve to one query
- **GIVEN** a card whose source key is `PAY-184`
- **WHEN** the user searches for `pay-184`, then `  PAY-184  `, then the full-width form `ＰＡＹ-１８４`
- **THEN** each search shows the same card

#### Scenario: Edge case — whitespace-only query
- **GIVEN** a populated board with no other filter active
- **WHEN** the user enters only spaces in the search field
- **THEN** every card remains visible
- **AND** empty lanes show their unfiltered empty message rather than a filtered-empty message

### Requirement: Present cards with a consistent, evidence-first anatomy

Each card SHALL show, in order: a text-labeled source badge (GitHub, GitLab, Jira · MCP, or Manual) with the source key when one exists and a freshness indicator; the title, limited to three lines; a context row with repository, owner, and relevance label when present; the evidence statement that explains the card's lane; an agent-assistance note when present; and a footer with an external-host indicator when the card has an external source. Absent optional values MUST be omitted rather than invented. All card text MUST be rendered as literal text. Cards MUST NOT show estimates, points, confidence scores, drag handles, or status controls.

#### Scenario: Happy path — imported idea card
- **GIVEN** a GitHub-sourced Idea card with key `#814`, a snapshot taken 14 minutes before generation, repository `acme/api-gateway`, owner "Priya Nair", relevance "Platform reliability", and evidence "Captured from GitHub #814"
- **WHEN** the board is displayed
- **THEN** the card shows the "GitHub" badge, `#814`, "Snapshot 14 min ago", the title, the repository, the owner, the relevance label, and the evidence text

#### Scenario: Failure — title contains markup
- **GIVEN** a card whose title is `<img src=x onerror=alert(1)> Fix login`
- **WHEN** the board is displayed
- **THEN** the title is shown as that literal text
- **AND** no image is requested and no script runs

#### Scenario: Edge case — manual card with no key, repository, or owner
- **GIVEN** a Manual card with no source key, no repository, and no owner
- **WHEN** the board is displayed
- **THEN** the card shows the "Manual" badge and "Created in Jumphour" evidence
- **AND** it shows no source key, no repository, no owner, and no external-host indicator

#### Scenario: Edge case — very long title
- **GIVEN** a card whose title is 400 characters long
- **WHEN** the board is displayed
- **THEN** the visible title is limited to three lines
- **AND** the card's accessible name still contains the full title

#### Scenario: Edge case — agent-assisted material is noted quietly
- **GIVEN** a card carrying the note "Drafted with agent assistance"
- **WHEN** the board is displayed
- **THEN** the note appears on the card as secondary text
- **AND** the card has no agent avatar, animation, or control

### Requirement: Select a card by pointer or keyboard

The system SHALL let a user select one card at a time by pointer or keyboard. The selected card MUST be identified both programmatically and by a visible indicator that does not rely on color alone. The selection SHALL be reflected in the page address so that the same address selects the same card, and an address naming a card that is not on the board MUST select nothing without producing an error.

#### Scenario: Happy path — select and deselect
- **GIVEN** a populated board with no card selected
- **WHEN** the user activates a card with a pointer, or focuses it and presses Enter or Space
- **THEN** that card is marked selected and the page address names that card
- **AND** activating the same card again clears the selection and the address

#### Scenario: Happy path — address selects a card
- **GIVEN** a card that is on the board
- **WHEN** the user opens the board using an address that names that card
- **THEN** that card is marked selected

#### Scenario: Failure — address names an unknown card
- **GIVEN** an address that names a card that is not on the current installation's board
- **WHEN** the user opens it
- **THEN** the board is displayed with no card selected
- **AND** no error page or error message is shown

#### Scenario: Edge case — selecting a second card
- **GIVEN** one card is selected
- **WHEN** the user activates a different card
- **THEN** only the newly activated card is marked selected

#### Scenario: Edge case — selected card is hidden by a filter
- **GIVEN** one card is selected
- **WHEN** the user applies a filter that hides that card from its lane
- **THEN** the selection is kept while the card still exists on the board
- **AND** clearing the filter shows the card still marked selected

### Requirement: Distinguish first-use, not-enabled, filtered-empty, and loading states

The system SHALL present distinct states for a board with no ideas, a board whose intake is not enabled, a lane emptied by filters, a lane with nothing derived into it, and a board that is loading. Lane headers MUST persist while a board is loading. No empty state may present sample cards or pitch broad project management.

#### Scenario: Happy path — first-use empty board with intake available
- **GIVEN** an installation with no cards, with Load ideas and Compose idea available
- **WHEN** the board is displayed
- **THEN** it shows "No ideas on this board yet", explains the two paths of loading read-only snapshots from a source or composing an idea, and offers Load ideas and Compose idea

#### Scenario: Failure — intake is not enabled
- **GIVEN** an installation with no cards, with Load ideas and Compose idea unavailable
- **WHEN** the board is displayed
- **THEN** it explains that idea intake is not enabled for this installation yet
- **AND** Load ideas and Compose idea are disabled with their reasons visible
- **AND** no sample or placeholder cards are shown

#### Scenario: Edge case — lane emptied by filters
- **GIVEN** a populated board
- **WHEN** the user filters to source "Jira · MCP" and a repository that has no Jira ideas
- **THEN** the Idea lane reads "No Jira ideas match this repository" and offers "Reset filters" and "Compose idea"
- **AND** other emptied lanes name the lane, for example "No in progress items match these filters", and offer "Reset filters"

#### Scenario: Edge case — nothing derived into a lane
- **GIVEN** a board with cards in Idea only and no filter active
- **WHEN** the board is displayed
- **THEN** the PR/MR lane reads "Nothing derived into PR/MR yet"
- **AND** it offers no "Reset filters" action

#### Scenario: Edge case — board is loading
- **GIVEN** a board whose data is being read
- **WHEN** the view is displayed before the data arrives
- **THEN** all four lane headers are shown with their titles and sublabels
- **AND** each lane shows placeholder cards and a lane-specific text label such as "Reconciling OpenSpec artifacts…", and is announced as busy
- **AND** when the user prefers reduced motion the placeholders do not animate

### Requirement: Provide single-lane navigation on small screens

On viewports narrower than 760px the system SHALL show one lane at a time with a lane selector that lists all four lanes and their counts, and SHALL keep search, filters, and Compose idea reachable. On wider viewports all four lanes SHALL be shown side by side with horizontal scrolling when they do not fit, and the lane selector MUST NOT be presented. Lanes MUST NOT be compressed into unreadable strips.

#### Scenario: Happy path — switch lanes on a phone
- **GIVEN** a populated board on a 400px-wide viewport
- **WHEN** the user selects "PR/MR" in the lane selector
- **THEN** only the PR/MR lane and its cards are shown
- **AND** the selector marks PR/MR as the current lane and shows each lane's count

#### Scenario: Failure — selected lane is emptied by filters
- **GIVEN** a 400px-wide viewport showing the In progress lane
- **WHEN** the user applies a filter that leaves In progress empty
- **THEN** the lane shows its filtered-empty message with "Reset filters"
- **AND** the lane selector still lists all four lanes with their counts

#### Scenario: Edge case — viewport grows past the breakpoint
- **GIVEN** a 400px-wide viewport showing only the PR/MR lane
- **WHEN** the viewport becomes 1280px wide
- **THEN** all four lanes are shown side by side
- **AND** the lane selector is neither visible nor exposed to assistive technology

### Requirement: Scope the board to the current installation

The system SHALL build the board only from data belonging to the session's current GitHub App installation. Repository filter options, cards, and listener states from one installation MUST NOT appear on another installation's board.

#### Scenario: Happy path — board lists only this installation's repositories
- **GIVEN** installation A with accessible repository `acme/api-gateway` and installation B with `beta/web`
- **AND** a signed-in user whose current installation is A
- **WHEN** they open the board
- **THEN** the repository filter offers `acme/api-gateway` and does not offer `beta/web`

#### Scenario: Failure — address names another installation's card
- **GIVEN** a card that belongs to installation B
- **AND** a signed-in user whose current installation is A
- **WHEN** they open the board using an address that names that card
- **THEN** no card is selected
- **AND** nothing about that card — title, source key, repository, or existence — is revealed

#### Scenario: Edge case — switching installations
- **GIVEN** a user with a repository filter and a search query active on installation A's board
- **WHEN** their current installation becomes B
- **THEN** the board shows only installation B's repositories and cards
- **AND** installation A's repository is not retained as the active filter
