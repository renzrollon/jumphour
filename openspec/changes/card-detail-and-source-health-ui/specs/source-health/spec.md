## Purpose

Shows whether each connected idea source and each lane listener is actually working — healthy, stale, delayed, or unreachable — and says so in text rather than color, so that a failed read is never mistaken for an empty board, for failed implementation, or for a two-way sync.

## ADDED Requirements

### Requirement: Present connected source status honestly

The source health view SHALL list every connected source with a text-labeled source badge, the scope that source reads, a status carried by text as well as by a non-color indicator, a one-line summary, and a supporting detail line. The status vocabulary MUST distinguish a healthy source, a stale snapshot, a lane-listener delay, and an unreachable or failed fetch. Every line MUST describe reading only; it MUST NOT describe the operation as synchronization or imply that anything is written to the source. When no source is connected the view MUST state that plainly and MUST NOT list an example, remembered, or sample source.

#### Scenario: Happy path — connected sources are distinguishable by text

- **GIVEN** connected GitHub, GitLab, and Jira-via-MCP sources
- **AND** GitHub is healthy, GitLab's newest snapshot is older than its staleness threshold, and Jira's last fetch failed
- **WHEN** the user opens source health
- **THEN** each source is listed with its text-labeled badge, its scope, and a status word that differs per state
- **AND** each status is legible with color removed, because the status word carries the meaning
- **AND** each detail line describes reads only and does not say "sync"

#### Scenario: Failure — an unreachable source keeps captured work visible

- **GIVEN** a connected GitHub source whose last two listens failed
- **WHEN** the user opens source health
- **THEN** the GitHub row states that it is unreachable
- **AND** it names when the last successful snapshot was captured
- **AND** the cards captured before the failure remain visible on the board

#### Scenario: Edge case — no sources are connected

- **GIVEN** an installation with no connected source
- **WHEN** the user opens source health
- **THEN** the view states that no sources are connected
- **AND** it lists no source rows
- **AND** it offers no connect, sign-in, or credential-entry control

### Requirement: List every lane listener state in lane order

The source health view SHALL list all four workflow lanes in the board's lane order, each with listener text worded by the same listener formatter the lane headers use, including the state in which no listener is configured. The view MUST NOT omit a lane because its listener is unconfigured, and MUST NOT state an interval or a last-heard time that the lane has not reported.

#### Scenario: Happy path — lane listener text matches the lane headers

- **GIVEN** a board whose four lanes report listener states
- **WHEN** the user opens source health
- **THEN** the four lanes appear in board order with their lane titles
- **AND** each lane's listener text is identical to the text that lane's board header shows
- **AND** no lane is missing from the list

#### Scenario: Failure — a delayed listener is described as delayed

- **GIVEN** the In progress lane whose listener is delayed and retrying
- **WHEN** the user opens source health
- **THEN** that lane's line states that listening is delayed and retrying
- **AND** it does not describe the lane as healthy
- **AND** it does not state or imply that any card's content or placement changed because of the delay

#### Scenario: Edge case — an unconfigured listener is still listed

- **GIVEN** an installation where no lane listener is configured, which is the current production state
- **WHEN** the user opens source health
- **THEN** all four lanes are listed
- **AND** each states that no listener is configured
- **AND** none states "Listening every 5 min", an interval, or a last-heard time

### Requirement: Announce a source failure without hiding captured work

When a connected source fails, the system SHALL present a compact banner that names the failing source and the time of its last successful snapshot, while the cards captured before the failure stay visible. A Jira-via-MCP failure MUST use its own copy: the title "Jira via MCP is unavailable", a body stating "We couldn't refresh Jira snapshots for <scope>. Your last captured Jira ideas are still shown.", and the hint "Check the MCP connection or try again.", offering exactly the actions "Retry Jira source" and "View connection details". No failure state MAY offer a login, OAuth, credential, or direct source API configuration surface.

#### Scenario: Happy path — a GitHub failure names the source and last success

- **GIVEN** a connected GitHub source whose last two listens failed 48 minutes after the last success
- **WHEN** the board renders
- **THEN** a banner names GitHub as the source that could not be reached
- **AND** it states that the last successful snapshot was captured 48 minutes ago
- **AND** the previously captured GitHub cards are still listed in their lanes

#### Scenario: Failure — Jira via MCP uses its own copy and offers no credential setup

- **GIVEN** a connected Jira-via-MCP source scoped to `Payments` whose refresh failed
- **WHEN** the board renders
- **THEN** the banner title reads "Jira via MCP is unavailable"
- **AND** the body reads "We couldn't refresh Jira snapshots for Payments. Your last captured Jira ideas are still shown."
- **AND** the hint reads "Check the MCP connection or try again."
- **AND** the only actions offered are "Retry Jira source" and "View connection details"
- **AND** no Jira login form, OAuth step, or API token field is offered

#### Scenario: Edge case — a source fails before it ever succeeded

- **GIVEN** a connected source that has never completed a successful snapshot
- **WHEN** its first read fails and the banner renders
- **THEN** the banner names the source and states that no successful snapshot has been captured yet
- **AND** it shows no fabricated last-success time and no "0 minutes ago"
- **AND** it does not claim that previously captured cards from that source are still shown

### Requirement: Gate retry on supplied availability and keep failure copy honest

A retry control SHALL be rendered only from the availability the prepared source data supplies for that source: available renders an enabled control, unavailable renders a disabled control whose supplied reason is visible as text, and an absent retry renders no control. Retry copy MUST describe an immediate read and MUST NOT use the word "sync" or otherwise imply a write back to the source. A failed session-log or session-evidence read MUST be described as an evidence read that failed, never as failed, stalled, or rejected implementation.

#### Scenario: Happy path — an available retry requests a fresh read

- **GIVEN** an unreachable GitHub source whose prepared data marks retry available
- **WHEN** the user activates "Retry GitHub source"
- **THEN** an immediate read of that source is requested
- **AND** the control's surrounding copy describes a read, not a sync or an update to the source
- **AND** no write is issued to GitHub

#### Scenario: Failure — an unavailable retry states its reason

- **GIVEN** a source whose prepared data marks retry unavailable with the reason "Source reads are not enabled for this installation yet."
- **WHEN** the user opens source health
- **THEN** the retry control is rendered disabled
- **AND** that reason is visible as text beside it
- **AND** the view does not claim that a retry is already running or scheduled

#### Scenario: Edge case — a failed session-evidence read is not failed implementation

- **GIVEN** a lane whose session-evidence read failed while its repository facts were read successfully
- **WHEN** the user opens source health
- **THEN** the view states that the session-evidence read failed
- **AND** it does not state that implementation failed, that work stopped, or that a card regressed to an earlier lane
- **AND** the affected cards keep the lane placement their repository facts derived

### Requirement: Expose source status in settings and keep one side panel open at a time

The settings surface SHALL include a status-only "Source connections" list that uses the same badges and status vocabulary as the source health view, plus an entry that opens source health. That list MUST NOT offer credential entry, connection editing, or a connect action. At most one side panel SHALL be open at a time: opening source health MUST close an open card detail view, and opening a card detail view MUST close an open source health view.

#### Scenario: Happy path — settings shows status and opens source health

- **GIVEN** connected GitHub, GitLab, and Jira-via-MCP sources
- **WHEN** the user opens settings
- **THEN** a "Source connections" list shows each source's badge and status using the same words as source health
- **AND** the list offers no field, button, or link that would edit or create a connection
- **AND** activating "Open source health" opens the source health view and closes settings

#### Scenario: Failure — settings with no connected sources

- **GIVEN** an installation with no connected source
- **WHEN** the user opens settings
- **THEN** the "Source connections" section states that no sources are connected
- **AND** it lists no source
- **AND** the entry that opens source health is still available
- **AND** no credential or connect control appears

#### Scenario: Edge case — opening one side panel closes the other

- **GIVEN** an open source health view
- **WHEN** the user selects a board card
- **THEN** the card's detail view opens
- **AND** the source health view closes
- **AND** opening source health again from settings closes the card detail view, leaving exactly one side panel open
