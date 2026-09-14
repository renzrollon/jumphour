## Purpose

Preserves attributable, immutable source snapshots and permalinks separately from later interpretation, treats imported content as untrusted data, never writes back to intake sources, and isolates snapshot data by GitHub App installation.

## ADDED Requirements

### Requirement: Store immutable snapshots with provenance metadata

The system SHALL persist each saved or refreshed capture as an append-only snapshot. A snapshot MUST include source kind, external identifier when present, canonical permalink when imported (or an explicit manual label when not), title and body as retrieved, content hash of the normalized payload, fetch or create timestamp, and adapter identity/version for MCP captures. The Idea identity for an imported item MUST be the tuple (installation, source kind, external identifier). Snapshot identity MUST be a distinct immutable snapshot id. Content hash MUST be computed once at the snapshot boundary from the normalized payload; every consumer MUST read stored hash and fields rather than re-hashing ad hoc.

#### Scenario: Happy path — saved import has permalink and hash
- **GIVEN** a user saves an accessible GitHub issue
- **WHEN** the snapshot is stored
- **THEN** it includes source kind `github-issue`, canonical permalink, fetch time, adapter identity/version, and content hash
- **AND** the Idea can be opened to show those provenance fields

#### Scenario: Failure — adapter returns no permalink for an imported kind
- **GIVEN** an MCP item whose source kind is not `manual`
- **AND** the adapter omits a canonical permalink
- **WHEN** the user attempts to save
- **THEN** the system does not store a snapshot that pretends to have a permalink
- **AND** it reports that permalink is missing rather than fabricating a URL

#### Scenario: Edge case — same external id in two installations is two Ideas
- **GIVEN** GitLab issue `!12` is saved under installation A
- **WHEN** a user in installation B saves the same GitLab issue id
- **THEN** installation B gets a separate Idea and snapshot
- **AND** A’s snapshot is not reused as B’s provenance

### Requirement: Refresh creates a new snapshot

An explicit refresh of an imported Idea MUST create a new timestamped snapshot and MUST NOT rewrite any earlier snapshot row, including a snapshot later marked as the one used for promotion.

#### Scenario: Happy path — refresh appends a second snapshot
- **GIVEN** an imported Idea with snapshot S1
- **WHEN** the user refreshes it and the adapter returns current content
- **THEN** snapshot S2 is stored with a new fetch time and hash
- **AND** S1 remains unchanged and readable

#### Scenario: Failure — refresh fails
- **GIVEN** an imported Idea with snapshot S1
- **WHEN** refresh fails because the adapter errors
- **THEN** S1 remains the latest stored snapshot
- **AND** the system shows an actionable error
- **AND** it does not delete the Idea

#### Scenario: Edge case — refresh does not overwrite a promotion-selected snapshot
- **GIVEN** an Idea with snapshots S1 and S2
- **AND** S1 is marked as the snapshot selected for a future promotion
- **WHEN** the user refreshes and S3 is stored
- **THEN** S1’s bytes, hash, and timestamp are unchanged
- **AND** S3 is a new row

### Requirement: Preserve provenance separately from interpretation

When a user opens an Idea, the system SHALL show original permalink or Manual label, selected snapshot time and hash, and any later human-authored framing as separate fields. Human-authored interpretation MUST NOT be written into an existing snapshot.

#### Scenario: Happy path — detail shows snapshot distinct from notes
- **GIVEN** a saved imported Idea with an optional interpretation note
- **WHEN** the user opens idea detail
- **THEN** they see permalink, snapshot timestamp, and content hash
- **AND** interpretation notes are visually and structurally separate from the snapshot body

#### Scenario: Failure — interpretation cannot replace snapshot text
- **GIVEN** a stored snapshot body
- **WHEN** a user edits interpretation notes
- **THEN** the snapshot body, hash, and fetch time remain unchanged

#### Scenario: Edge case — manual Idea has no fake permalink
- **GIVEN** a manual Idea
- **WHEN** the user opens detail
- **THEN** the system labels it as created in Jumphour
- **AND** it does not display a fabricated GitHub, GitLab, or Jira permalink

### Requirement: Never write to an intake source

The system MUST NOT create or update comments, labels, transitions, assignments, or other mutations on GitHub Issues, GitLab issues, or Jira when a user imports, refreshes, views, lists, or (in later changes) promotes an Idea.

#### Scenario: Happy path — save does not mutate the source
- **GIVEN** an accessible Jira item
- **WHEN** the user saves it as an Idea
- **THEN** the adapter performs no write to Jira
- **AND** the source item’s comments, labels, and status are unchanged by Jumphour

#### Scenario: Failure — refresh does not write a “synced from Jumphour” comment
- **GIVEN** a saved imported Idea
- **WHEN** the user refreshes it
- **THEN** the system still issues no source write
- **AND** a failed refresh does not attempt a compensating source mutation

#### Scenario: Edge case — Load ideas and listener are read-only
- **GIVEN** configured GitHub and GitLab inboxes
- **WHEN** Load ideas or the five-minute listener runs
- **THEN** those operations only read
- **AND** they do not add labels, assignees, or comments to source issues

### Requirement: Treat imported content as untrusted

Imported title, body, labels, and links MUST be stored as data and sanitized for display. The system MUST NOT interpret imported text as commands, tool calls, repository selection, inbox configuration, or executable settings. Display sanitization MUST happen at a single rendering boundary; consumers MUST NOT “eval” raw snapshot HTML.

#### Scenario: Happy path — markdown is displayed as content
- **GIVEN** an imported issue whose body contains ordinary markdown links
- **WHEN** a user views the snapshot
- **THEN** the body is shown as sanitized display content
- **AND** links do not navigate with unsanitized HTML execution

#### Scenario: Failure — instructional or hostile markup is not executed
- **GIVEN** an imported body that contains script tags, prompt-like instructions to change repository, or requests to run tools
- **WHEN** the snapshot is displayed or processed for intake
- **THEN** the system does not execute script
- **AND** it does not change the selected installation, inbox, or repository from that text

#### Scenario: Edge case — body mentions a repository name
- **GIVEN** an issue body that names `acme/secret-ledger`
- **WHEN** the Idea is saved
- **THEN** the Idea is not bound to that repository
- **AND** Change 1 discovery and repo list remain unchanged by the import

### Requirement: Isolate snapshots by installation

Snapshots, Idea lists, and adapter configuration MUST belong to one GitHub App installation. The system MUST NOT show or reuse another installation’s snapshot bytes, hashes, or permalinks.

#### Scenario: Happy path — viewer sees only current installation snapshots
- **GIVEN** snapshots stored for installation A
- **WHEN** a user in installation A opens an Idea
- **THEN** they see A’s snapshot history only

#### Scenario: Failure — installation B cannot read A’s snapshot payload
- **GIVEN** a snapshot id that belongs to installation A
- **WHEN** a user in installation B requests that snapshot
- **THEN** the system refuses
- **AND** it does not return the snapshot body or hash

#### Scenario: Edge case — content hash equality does not leak across tenants
- **GIVEN** two installations independently saved issues whose normalized payloads hash to the same value
- **WHEN** a user in installation A lists Ideas
- **THEN** they do not see installation B’s Idea ids or permalinks merely because hashes match

### Requirement: Retain and delete snapshots under a stated policy

The system SHALL retain snapshots for ninety days after the later of last save, refresh, or view. A signed-in user in the installation MAY soft-delete an Idea, which hides it from the intake list. After retention, the system MAY hard-delete snapshots that are not referenced by a promotion record. A snapshot marked as selected for promotion MUST NOT be hard-deleted.

#### Scenario: Happy path — recent snapshot remains readable
- **GIVEN** a snapshot saved within the last ninety days
- **WHEN** a user in the installation opens the Idea
- **THEN** the snapshot body and hash are still available

#### Scenario: Failure — soft-delete hides without source write-back
- **GIVEN** a saved Idea
- **WHEN** a signed-in user in that installation soft-deletes it
- **THEN** it no longer appears on the intake list
- **AND** the system does not comment on or close the source issue

#### Scenario: Edge case — promotion-selected snapshot survives retention
- **GIVEN** a snapshot older than ninety days that is marked as selected for promotion
- **WHEN** retention cleanup runs
- **THEN** that snapshot is not hard-deleted
- **AND** an unreferenced snapshot past retention may be hard-deleted
