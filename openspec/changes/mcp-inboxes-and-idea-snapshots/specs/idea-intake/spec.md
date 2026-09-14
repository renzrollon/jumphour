## Purpose

Lets a signed-in team load and save ideas from read-only MCP inboxes and a local manual inbox, with a five-minute Idea listener and an explicit Load ideas action, without writing back to sources or presenting a workflow board.

## ADDED Requirements

### Requirement: Import an idea through a configured MCP adapter

The system SHALL let a signed-in user save an accessible GitHub Issue, GitLab issue, or Jira item from a configured adapter as an Idea in the current GitHub App installation. Saving MUST create a normalized snapshot. Candidates shown before save MUST NOT become Ideas until the user saves. The system MUST NOT require a GitHub repository to save an Idea.

Normalized snapshot fields MUST include: source kind (`github-issue` | `gitlab-issue` | `jira`), immutable external identifier when the adapter provides one, canonical permalink, title, body/description, visible state, labels/tags, author/display name, and source timestamps when available, plus fetch timestamp, adapter identity/version, and snapshot content hash. Missing optional fields MUST be stored as absent, not invented.

#### Scenario: Happy path — save an accessible GitLab item
- **GIVEN** a signed-in user in an installation with a configured GitLab adapter
- **AND** the adapter returns an accessible issue with a permalink
- **WHEN** the user saves that item
- **THEN** the system stores an Idea with source kind `gitlab-issue`, the canonical permalink, adapter identity, fetch time, and content hash
- **AND** the item appears in the saved-ideas list for that installation
- **AND** no GitHub repository is required for the save

#### Scenario: Failure — adapter denies access
- **GIVEN** a configured Jira adapter that denies or errors on a selected item
- **WHEN** the user attempts to save that item
- **THEN** the system does not create an Idea
- **AND** it shows an actionable failure (unavailable, unauthorized, or misconfigured)
- **AND** it does not claim the source issue was deleted

#### Scenario: Edge case — candidates are not Ideas
- **GIVEN** Load ideas or the listener has returned candidate GitHub issues
- **WHEN** the user dismisses the candidate list without saving
- **THEN** no new Idea or snapshot rows exist for those candidates
- **AND** a later Load ideas may show them again as candidates

### Requirement: Listen to configured inboxes every five minutes

The system SHALL poll configured MCP inboxes and the local manual inbox for the current installation every five minutes by default. It MUST record last attempt time and last successful listen time, apply bounded retry/backoff on failure, and keep showing the last known saved Ideas with a stale or error last-heard state. Success MUST reset the interval to five minutes. Backoff MUST cap at ten minutes (twice the default interval).

#### Scenario: Happy path — successful listen updates last-heard
- **GIVEN** an installation with at least one configured inbox
- **WHEN** the Idea listener completes a successful read
- **THEN** last successful listen time is updated
- **AND** the intake surface shows that the Idea lane is listening every five minutes and when it last heard

#### Scenario: Failure — listen fails and does not delete Ideas
- **GIVEN** saved Ideas already exist for the installation
- **AND** the next listener read fails
- **THEN** existing Ideas and snapshots remain
- **AND** last-heard shows failure or delayed/retrying with the last successful time when known
- **AND** the next retry is delayed by bounded backoff rather than immediate tight looping

#### Scenario: Edge case — backoff resets after success
- **GIVEN** the listener has backed off after consecutive failures
- **WHEN** a later listen succeeds
- **THEN** the schedule returns to every five minutes
- **AND** last successful listen time is the successful run

### Requirement: Load ideas on demand

The system SHALL let a signed-in user invoke **Load ideas** for one or more selected inboxes among GitHub Issues, GitLab issues, and Jira via MCP, and Manual, limited to inboxes configured for the current installation (Manual is always available). Load ideas MUST perform an immediate read, MUST NOT mutate a source system, and MUST NOT be described as synchronization. Selecting Manual MUST re-read the local manual inbox only; it MUST NOT create a manual Idea.

#### Scenario: Happy path — Load ideas reads selected MCP inboxes
- **GIVEN** a signed-in user and configured GitHub and Jira inboxes
- **WHEN** they invoke Load ideas for GitHub and Jira
- **THEN** the system performs an immediate read of those inboxes
- **AND** it shows candidates without writing comments, labels, or status to those sources
- **AND** a successful Load ideas updates Idea-lane last successful listen time for the installation

#### Scenario: Failure — selected MCP inbox is unavailable
- **GIVEN** the Jira adapter is `unavailable` or `misconfigured`
- **WHEN** the user invokes Load ideas including Jira
- **THEN** the system reports that Jira via MCP could not be read
- **AND** it still reads any other selected inboxes that are available
- **AND** it does not invent Jira candidates

#### Scenario: Edge case — Load ideas for Manual does not compose
- **GIVEN** existing manual Ideas in the installation
- **WHEN** the user invokes Load ideas with only Manual selected
- **THEN** the system re-reads the local manual inbox
- **AND** it does not create a new manual Idea
- **AND** compose remains the only create path for manual Ideas

### Requirement: Create a manual idea

The system SHALL let a signed-in user create a manual Idea by providing a non-empty title and non-empty description. Optional supporting links MAY be stored. The Idea MUST be labeled as manually entered, MUST record author (GitHub user) and creation time, and MUST NOT present a fabricated external permalink, required repository, or owner/assignee field.

#### Scenario: Happy path — compose with required fields
- **GIVEN** a signed-in user in an installation
- **WHEN** they submit title and description
- **THEN** a manual Idea appears in that installation’s saved-ideas list
- **AND** it shows a Manual label, author, and creation time
- **AND** it has no external source permalink

#### Scenario: Failure — missing required fields
- **GIVEN** a compose form
- **WHEN** the user submits with an empty title or empty description
- **THEN** the system does not create an Idea
- **AND** it shows a validation error for the missing field

#### Scenario: Edge case — optional links without repository or owner
- **GIVEN** a user submits title, description, and optional supporting links
- **WHEN** the Idea is saved
- **THEN** the links are stored as supporting links
- **AND** the Idea has no required repository and no assignee/owner field

### Requirement: Scope intake to the current installation

The system SHALL list, save, and listen for Ideas only in the signed-in user’s current GitHub App installation. It MUST NOT merge inboxes or Ideas across installations.

#### Scenario: Happy path — saved Ideas match the current installation
- **GIVEN** installation A has saved Ideas and installation B has different Ideas
- **AND** the user is working in installation A
- **WHEN** they open the intake surface
- **THEN** they see only installation A’s Ideas, candidates, and inbox configuration

#### Scenario: Failure — cross-installation read is refused
- **GIVEN** a user whose current context is installation A
- **WHEN** they request an Idea or snapshot that belongs to installation B
- **THEN** the system refuses the request
- **AND** it does not return B’s titles, permalinks, or snapshot bodies

#### Scenario: Edge case — switching installations replaces the intake list
- **GIVEN** the same GitHub user can access installations A and B
- **WHEN** they switch from A to B
- **THEN** the saved-ideas list, candidates, last-heard state, and inbox configuration are B’s
- **AND** A and B are not merged

### Requirement: Present an intake surface without workflow board columns

The system SHALL present Load ideas, candidates, saved Ideas, manual compose, Idea-lane last-heard state, and idea-detail provenance on an intake surface. It MUST NOT present the four-column Idea / OpenSpec change / In progress / PR/MR board in this change. Saving an Idea MUST NOT require OpenSpec `supported` status.

#### Scenario: Happy path — intake list with last-heard
- **GIVEN** a signed-in user with at least one saved Idea
- **WHEN** they open the intake surface
- **THEN** they see saved Ideas and Idea-lane last-heard state
- **AND** they do not see OpenSpec change, In progress, or PR/MR columns

#### Scenario: Failure — empty intake
- **GIVEN** a signed-in user with no saved Ideas
- **WHEN** they open the intake surface
- **THEN** they see an empty state that offers Load ideas and compose
- **AND** the copy does not describe a missing workflow board

#### Scenario: Edge case — save is allowed when discovery is unsupported
- **GIVEN** Change 1 discovery reports the installation’s repositories as `unsupported`
- **WHEN** the user saves an imported or manual Idea
- **THEN** the Idea is stored
- **AND** the system does not block save on OpenSpec support status
