## Purpose

Fills the workflow board's Idea lane with real ideas: read-only inboxes are read on a five-minute lane listener or on demand, returned items are reviewed as candidates before anything is saved, and a person may compose an idea directly in Jumphour — so every Idea card is backed by a stored snapshot and no source is ever written to.

## ADDED Requirements

### Requirement: Import an idea through a configured MCP adapter

The system SHALL let a signed-in user save an accessible GitHub Issue, GitLab issue, or Jira item from an inbox configured for the current GitHub App installation as an Idea of that installation. Saving MUST re-read the named item from its source through that inbox's adapter and store only what the source returns; item content supplied by the browser MUST NOT be stored. A saved Idea MUST appear as a card in the board's Idea lane. Candidates offered for review MUST NOT become Ideas until the user saves one. Saving MUST NOT require a GitHub repository and MUST NOT depend on the OpenSpec support status of the installation's repositories. A save that cannot read its item has exactly two possible failures. The source could not be read — it was unreachable, it errored, or it rejected the connection's credential — which may succeed on a later attempt; or the connection is misconfigured, meaning its configuration is unusable before any read is attempted. A rejected credential is a failed read, not a third outcome of its own and not a misconfiguration.

The normalized snapshot stored on save MUST include: source kind (`github-issue`, `gitlab-issue`, or `jira`); the immutable external identifier the adapter supplies; a separate human-readable source display key such as `#814` or `PAY-184`, kept distinct from that external identifier; the canonical permalink; title; body or description; visible state; labels or tags; author display name; and source timestamps when available — plus the fetch time, the adapter's identity and version, and a content hash of the normalized payload. An optional field the source does not supply MUST be stored as absent, never invented.

#### Scenario: Happy path — save an accessible GitLab item as an Idea-lane card
- **GIVEN** a signed-in user whose current installation has a configured GitLab inbox
- **AND** a candidate whose adapter record carries an accessible issue, a canonical permalink, the immutable external identifier `gid://gitlab/Issue/33920`, and the display key `#412`
- **WHEN** the user saves that candidate
- **THEN** an Idea is stored for that installation with source kind `gitlab-issue`, the canonical permalink, the adapter identity and version, the fetch time, and the content hash
- **AND** the display key `#412` and the external identifier `gid://gitlab/Issue/33920` are stored as two separate values
- **AND** the Idea appears as a card in that installation's Idea lane
- **AND** no GitHub repository is required for the save

#### Scenario: Happy path — the stored snapshot comes from the source, not from the browser
- **GIVEN** a save request that names an inbox and an external identifier and also carries a title and a body of its own
- **AND** the source's own title for that item is `Retry finance exports`
- **WHEN** the system saves the item
- **THEN** it re-reads the item through the configured adapter and stores the source's title `Retry finance exports`
- **AND** the title and body carried by the request are discarded rather than stored
- **AND** the stored content hash is computed from the re-read payload

#### Scenario: Failure — the adapter cannot read the selected item
- **GIVEN** a configured Jira inbox whose source rejects the connection's credential when the selected item is read
- **WHEN** the user attempts to save that item
- **THEN** no Idea and no snapshot is created
- **AND** the failure states "Jira could not be read.", exactly as it would for a source that was unreachable, and does not report the connection as misconfigured
- **AND** the same save may succeed on a later attempt without anyone changing the connection's configuration
- **AND** the failure does not claim that the source item was deleted or that it no longer exists

#### Scenario: Edge case — candidates are not Ideas
- **GIVEN** a completed read that has returned candidate GitHub issues for review
- **WHEN** the user closes the review without saving any of them
- **THEN** no Idea and no snapshot exists for those candidates
- **AND** no card for them appears in the Idea lane
- **AND** a later read of the same inbox may offer them again as candidates

#### Scenario: Edge case — save is allowed when OpenSpec discovery reports unsupported
- **GIVEN** an installation whose repositories are all reported as `unsupported` by OpenSpec discovery
- **WHEN** the user saves an imported item
- **THEN** the Idea is stored and appears in the Idea lane
- **AND** the save is not blocked on OpenSpec support status
- **AND** no GitHub repository is required for it and none is recorded on the Idea

### Requirement: Listen to configured inboxes every five minutes

The system SHALL read every inbox configured for an installation on an Idea-lane listener that runs every five minutes by default. The listener SHALL begin running for an installation as soon as that installation has a configured inbox, with no manual step and without waiting for any earlier run to exist: that installation's first run is due immediately, and the listener reads its inboxes the next time it wakes. When the last configured inbox of an installation is removed from configuration the listener SHALL stop reading for that installation and the Idea lane SHALL return to "Listener not configured". A run SHALL count as successful only when every configured inbox was read successfully; on success the lane's last successful listen time advances and the interval returns to five minutes. When any configured inbox fails, the run MUST be recorded as a failure: the lane's last successful listen time MUST NOT advance, each inbox still records its own read outcome, and the next run MUST be delayed by a bounded backoff of one, then two, then four, then eight minutes, never exceeding ten minutes. Ideas and snapshots already stored MUST survive a failed run. The listener MUST NEVER save a candidate as an Idea. Ideas created in Jumphour are local records and MUST NOT be read from any source.

#### Scenario: Happy path — a successful run advances the last successful listen
- **GIVEN** an installation with a configured GitHub inbox and a configured Jira inbox
- **WHEN** a listener run reads both inboxes successfully
- **THEN** the lane's last successful listen time becomes that run's time
- **AND** the next run is scheduled five minutes later
- **AND** the Idea lane header reads "Listening every 5 min"

#### Scenario: Failure — one inbox of two fails and the lane records a failure
- **GIVEN** an installation with a configured GitHub inbox, a configured Jira inbox, and saved Ideas already on the board
- **WHEN** a run reads GitHub successfully and the Jira read fails
- **THEN** the run is recorded as a failure and the lane's last successful listen time does not advance
- **AND** the GitHub inbox records a successful read and the Jira inbox records a failed read
- **AND** the next run is delayed by one minute, and by two, four, and eight minutes on further consecutive failures, never beyond ten minutes
- **AND** every saved Idea and every stored snapshot remains, and the Idea lane still shows those cards

#### Scenario: Edge case — the listener never saves a candidate
- **GIVEN** a configured inbox holding items that have never been saved as Ideas
- **WHEN** a listener run reads that inbox successfully
- **THEN** no Idea and no snapshot is created for those items
- **AND** no new card appears in the Idea lane
- **AND** the only state the run changes is the lane's listen state and each inbox's read health
- **AND** the items are still offered as candidates the next time that inbox is read on demand

#### Scenario: Edge case — backoff resets after a success
- **GIVEN** a listener that has backed off to ten minutes after consecutive failures
- **WHEN** a later run reads every configured inbox successfully
- **THEN** the interval returns to five minutes
- **AND** the lane's last successful listen time becomes that run's time

#### Scenario: Edge case — the first run for a newly configured installation
- **GIVEN** an installation that has just gained its first configured inbox and has never been listened to
- **WHEN** the listener next wakes
- **THEN** that installation's inboxes are read on that wake, without any manual step and without an earlier run having to exist
- **AND** before that first run completes the Idea lane reads "Listening every 5 min" and "Not heard yet"

#### Scenario: Edge case — ideas created in Jumphour are not read from a source
- **GIVEN** an installation with one configured GitHub inbox and two Ideas created in Jumphour
- **WHEN** a listener run completes
- **THEN** no read is attempted for the two Ideas created in Jumphour and they are unchanged
- **AND** the run's success depends only on the configured GitHub inbox

### Requirement: Load ideas on demand

The system SHALL offer the board's Load ideas control, in the board toolbar and on the Idea lane header, and each invocation SHALL read exactly one selected inbox. The options SHALL be every inbox configured for the current installation — listed even when that connection is currently unavailable or misconfigured — plus a Manual option that is always offered. Load ideas MUST perform an immediate read, MUST NOT write anything to a source, and MUST NOT be described as synchronization. While a read is in flight the control SHALL show a pending state and MUST NOT accept a second read. Choosing Manual SHALL re-read the Ideas created in Jumphour for that installation, MUST create nothing, and MUST NOT open a candidate review. When the session has no current installation the control SHALL be unavailable with the visible reason "Select a GitHub App installation to load or compose ideas." A Load ideas read SHALL update the chosen inbox's connection health and MUST NOT change the Idea lane's listener state.

#### Scenario: Happy path — choosing one inbox reads only that inbox now
- **GIVEN** a signed-in user whose installation has configured GitHub and Jira inboxes
- **WHEN** they open Load ideas and choose Jira
- **THEN** the Jira inbox is read immediately and the GitHub inbox is not read
- **AND** the control describes the action as an immediate read that never writes back
- **AND** no comment, label, status, or other write is issued to Jira
- **AND** the read is described as a read, never as a sync

#### Scenario: Happy path — every configured inbox is offered alongside Manual
- **GIVEN** an installation with configured GitHub, GitLab, and Jira inboxes, where the Jira connection is currently unreachable and the GitLab connection is misconfigured
- **WHEN** the user opens Load ideas
- **THEN** GitHub, GitLab, and Jira are each offered as options, together with Manual
- **AND** no option is hidden because its connection is currently unreachable or misconfigured
- **AND** each option is labeled in text, with GitHub, GitLab, and Jira marked as read via MCP

#### Scenario: Failure — the chosen inbox cannot be read
- **GIVEN** an installation whose Jira connection is unreachable
- **WHEN** the user chooses Jira in Load ideas
- **THEN** the result states that Jira could not be read
- **AND** no candidate is invented for Jira and no Idea is created
- **AND** the Jira connection's health records the failed read
- **AND** the Idea lane's listener state is unchanged

#### Scenario: Failure — Load ideas is unavailable without a current installation
- **GIVEN** a signed-in session that names no current GitHub App installation
- **WHEN** the board is displayed
- **THEN** Load ideas is disabled in both the toolbar and the Idea lane header
- **AND** the reason "Select a GitHub App installation to load or compose ideas." is visible as text without hovering
- **AND** activating the disabled control requests no read and opens no menu

#### Scenario: Edge case — choosing Manual re-reads local Ideas and creates nothing
- **GIVEN** an installation that already holds Ideas created in Jumphour
- **WHEN** the user chooses Manual in Load ideas
- **THEN** the Ideas created in Jumphour are re-read and the Idea lane is redisplayed from them
- **AND** no new Idea is created and no candidate review opens
- **AND** composing remains the only way to create an Idea in Jumphour

#### Scenario: Edge case — a read in flight refuses a second read and leaves the lane alone
- **GIVEN** a Load ideas read of the GitHub inbox that has been requested and has not yet resolved
- **WHEN** the user activates Load ideas again
- **THEN** the control shows its pending state and no second read is requested
- **AND** when the read resolves successfully, the GitHub connection's health records the successful read
- **AND** the Idea lane's last successful listen time and its listener state are unchanged by that read

### Requirement: Review candidates before saving

When a read of an external inbox completes, the system SHALL present its result for review before anything is saved, in exactly one of four states: reading, candidates returned, zero candidates, or unreadable. The review SHALL be titled "Load ideas from <source label>" and SHALL carry the subline "Read just now. Nothing is saved until you choose Save. Never writes back." Each candidate that is not yet an Idea SHALL offer "Save snapshot". A candidate that is already saved as an Idea SHALL show the status text "Already saved" with the age of that Idea's stored snapshot and SHALL offer "Save new snapshot", which appends a snapshot to that same Idea rather than creating a second card. Only an Idea that has not been removed counts as already saved: a candidate whose Idea was removed SHALL be offered as an ordinary candidate, and saving it MUST restore that same Idea with a new snapshot rather than create a second Idea. A saved row MUST stay in place and change to the status text "Saved"; a failed save MUST report inline on that row only and MUST leave every other row usable. A row whose save is in flight MUST NOT accept a second save: activating "Save snapshot" twice in quick succession MUST store exactly one Idea and one snapshot, and the row MUST end as "Saved". A read SHALL return at most fifty candidates, ordered most recently updated first; when the source holds more, the review SHALL state "Showing the 50 most recently updated items." and list exactly fifty rows, and when it holds fifty or fewer that sentence MUST be absent.

The unreadable state SHALL report the connection as `unreachable` — the same status word connection health uses — followed by exactly one reason sentence: "<source> could not be read." — naming the source plainly, as in "Jira could not be read." — when the read failed for any reason, including an unreachable source or a rejected credential, or "This connection is misconfigured. An operator must fix its configuration." when its configuration is unusable before any read is attempted. It SHALL also state "Your saved ideas are unchanged." The unreadable state MUST NOT offer an action that opens the connection health view; when the review is closed the board data is read again, so the board's own source status banner and the connection health view carry the detail. No state MAY offer a login, OAuth, credential-entry, or connection-editing control. Closing the review SHALL discard every unsaved candidate and create nothing. All candidate text MUST be rendered strictly as literal text.

The review MUST itself provide list semantics, a per-row accessible name composed of that candidate's source display key and title, a Save control whose accessible name includes its own row's key and title, and a status region that announces the number of candidates returned, each row's saved or failed outcome, and the unreadable state. Every state MUST be carried by text rather than by tint alone. The review is a modal surface layered over whatever the board was showing, including an open card detail, and it MUST NOT itself open a card detail view or the connection health view. Overlay focus trapping, dismissal, focus restoration — including returning focus to the control that opened the review — focus indication, contrast, touch-target size, and reduced-motion behavior are governed by the `design-system` capability and are not restated here.

#### Scenario: Happy path — a completed read opens the review with its own copy
- **GIVEN** a Load ideas read of the GitHub inbox that returns three candidates
- **WHEN** the review opens
- **THEN** its title reads "Load ideas from GitHub" and its subline reads "Read just now. Nothing is saved until you choose Save. Never writes back."
- **AND** the three candidates are presented as a list whose rows are each named by that candidate's source display key and title
- **AND** each row offers "Save snapshot" and nothing is saved before the user chooses it
- **AND** the number of candidates returned is announced through a status region
- **AND** a candidate titled `<img src=x onerror=alert(1)> Fix login` is shown as that literal text, no image is requested and no script runs

#### Scenario: Happy path — saving one candidate keeps its row and adds a card
- **GIVEN** an open review listing three candidates from the GitHub inbox
- **WHEN** the user activates "Save snapshot" on the second row
- **THEN** that row stays in its position and its status text becomes "Saved"
- **AND** the saved outcome is announced through the status region
- **AND** the other two rows remain listed and can still be saved
- **AND** a card for the saved Idea appears in the board's Idea lane

#### Scenario: Failure — one row's save fails and the rest stay usable
- **GIVEN** an open review listing three candidates
- **WHEN** a save of the first row fails
- **THEN** an inline error is shown on that row and is programmatically associated with it
- **AND** no error is shown on the other rows and both remain saveable
- **AND** no Idea and no snapshot exists for the failed row
- **AND** the failure is announced through the status region and is carried by text, not by tint alone

#### Scenario: Failure — the source could not be read
- **GIVEN** a Load ideas read of a GitHub inbox whose source could not be reached
- **WHEN** the review opens
- **THEN** it reports the connection as `unreachable` with the single reason sentence "GitHub could not be read.", and lists no candidate
- **AND** it states "Your saved ideas are unchanged."
- **AND** it offers no action that opens the connection health view and no action that opens a card detail view
- **AND** it offers no login form, no OAuth step, no credential field, and no connection-editing control

#### Scenario: Failure — the connection is misconfigured
- **GIVEN** a Load ideas read of a Jira inbox whose configuration names a credential that was never supplied, so no read can be attempted
- **WHEN** the review opens
- **THEN** it reports the connection as `unreachable` with the single reason sentence "This connection is misconfigured. An operator must fix its configuration.", and lists no candidate
- **AND** it states "Your saved ideas are unchanged."
- **AND** it offers no action that opens the connection health view, no login form, no OAuth step, no credential field, and no connection-editing control

#### Scenario: Edge case — the read returns zero candidates
- **GIVEN** a Load ideas read that completes successfully and returns no items
- **WHEN** the review opens
- **THEN** it states that the read returned no candidates, distinctly from the unreadable state
- **AND** it lists no rows and offers no Save control
- **AND** no Idea is created and the Idea lane is unchanged

#### Scenario: Edge case — two candidates with identical titles stay distinguishable
- **GIVEN** a read that returns two candidates both titled `Retry finance exports`, with the source display keys `#814` and `#902`
- **WHEN** the review lists them
- **THEN** one row's accessible name contains `#814` and that title, and the other's contains `#902` and that title
- **AND** each row's Save control's accessible name contains its own row's key and title, so the two controls are not interchangeable
- **AND** activating the Save control of `#902` marks only that row "Saved", and the `#814` row still offers "Save snapshot"

#### Scenario: Edge case — an already-saved candidate appends a snapshot
- **GIVEN** a read whose candidate `#814` is already saved as an Idea whose stored snapshot was fetched 14 minutes ago
- **WHEN** the review lists it
- **THEN** that row shows the status text "Already saved" with the age of that stored snapshot and offers "Save new snapshot"
- **AND** activating "Save new snapshot" appends a further snapshot to that same Idea
- **AND** no second card for `#814` appears in the Idea lane and the earlier snapshot is kept

#### Scenario: Edge case — saving a candidate whose Idea was removed restores that Idea
- **GIVEN** an Idea for GitHub issue `#814` that was removed from Jumphour, and a read that returns `#814` again
- **WHEN** the review lists it
- **THEN** that row offers "Save snapshot" and does not show "Already saved"
- **AND** activating it restores the same Idea to the Idea lane with a new snapshot
- **AND** no second Idea exists for `#814` and its earlier snapshots that still exist remain attached to it

#### Scenario: Edge case — a double activation saves once
- **GIVEN** an open review whose second row has a save in flight
- **WHEN** the user activates "Save snapshot" on that row a second time in quick succession
- **THEN** exactly one Idea and one snapshot are stored for that candidate
- **AND** the row does not accept the second activation while the first save is in flight
- **AND** the row ends as "Saved"

#### Scenario: Edge case — more than fifty items in the source
- **GIVEN** a GitHub inbox holding 120 items, and a Jira inbox holding 12
- **WHEN** a Load ideas read of each inbox opens its review
- **THEN** the GitHub review lists exactly 50 rows, most recently updated first, and states "Showing the 50 most recently updated items."
- **AND** the Jira review lists all 12 rows and does not state "Showing the 50 most recently updated items."

#### Scenario: Edge case — closing discards unsaved candidates
- **GIVEN** an open review listing five candidates of which one has been saved
- **WHEN** the user closes the review
- **THEN** the four unsaved candidates are discarded and no Idea, snapshot, or stored candidate record exists for them
- **AND** only the one saved Idea remains in the Idea lane
- **AND** a later read of the same inbox may offer the four again

### Requirement: Create a manual idea

The system SHALL let a signed-in user create an Idea directly in Jumphour from a title, a problem statement, and optional supporting links, and MUST enforce the same rules whether or not the request comes from the compose dialog. A title or problem statement that is empty once all Unicode whitespace is removed MUST be rejected with the missing field named; an accepted value MUST be stored with its surrounding whitespace removed. Supporting links MUST be split on line breaks, commas, or a mixture of both, entries that are empty after splitting MUST be discarded without comment, and the remaining entries MUST keep their entered order and their duplicates. Only `http` and `https` addresses are accepted; a request carrying an entry with any other scheme MUST be rejected with the offending entries named, never silently dropped and never rewritten to add a scheme.

The created Idea MUST record its author and creation time, MUST be presented as created in Jumphour, and MUST NOT carry an external permalink. No repository, owner, or assignee field MUST be offered or required. A successful create SHALL report the new Idea's identifier so the board can show and select that card. Creating an Idea in Jumphour MUST NOT depend on the OpenSpec support status of the installation's repositories. Composing SHALL be available whenever the session has a current GitHub App installation; with none it SHALL be unavailable with the visible reason "Select a GitHub App installation to load or compose ideas."

#### Scenario: Happy path — a composed idea becomes a selected Idea-lane card
- **GIVEN** a signed-in user whose session has a current GitHub App installation
- **AND** that installation's repositories are all reported as `unsupported` by OpenSpec discovery
- **WHEN** they submit a title and a problem statement
- **THEN** an Idea is created for that installation recording its author and creation time
- **AND** the new Idea's identifier is reported to the surface that submitted it
- **AND** the board shows that card in the Idea lane with the "Manual" badge and "Created in Jumphour" evidence, and selects it
- **AND** on a small screen where only one lane is shown at a time, the board switches to the Idea lane so the selected card is visible
- **AND** the card shows no repository, no owner, and no external-host indicator

#### Scenario: Failure — a request that bypasses the dialog is held to the same rules
- **GIVEN** a create request that did not originate from the compose dialog
- **AND** whose problem statement is a single ordinary space
- **WHEN** the system receives it
- **THEN** no Idea is created
- **AND** the refusal names the problem statement as the missing field rather than reporting a generic failure
- **AND** no card appears in the Idea lane

#### Scenario: Failure — a rejected link is named and nothing is created
- **GIVEN** a create request with an acceptable title and problem statement
- **AND** supporting links containing `https://a.example`, `javascript:alert(1)`, and `mailto:someone@example.test`
- **WHEN** the request is submitted
- **THEN** no Idea is created
- **AND** the refusal names `javascript:alert(1)` and `mailto:someone@example.test` as not accepted because only http and https links are supported
- **AND** neither entry is silently discarded, and neither is rewritten with a scheme added

#### Scenario: Failure — composing is unavailable without a current installation
- **GIVEN** a signed-in session that names no current GitHub App installation
- **WHEN** the board is displayed
- **THEN** the Compose idea entry point is disabled
- **AND** the reason "Select a GitHub App installation to load or compose ideas." is visible as text and available to assistive technology
- **AND** activating it opens no dialog and creates nothing

#### Scenario: Edge case — whitespace, trimming, order, and duplicates at the boundary
- **GIVEN** a create request whose title contains only a non-breaking space and an ideographic space
- **WHEN** the request is submitted
- **THEN** the title is treated as empty and no Idea is created
- **AND** a title of `  Retry finance exports  ` is instead accepted and stored as `Retry finance exports`
- **AND** supporting links of `https://a.example, https://a.example` are stored as two links in the order entered, because duplicates are preserved rather than collapsed

### Requirement: Scope intake to the current installation

The system SHALL read inboxes, save Ideas, run the Idea-lane listener, and report connection health only for the signed-in user's current GitHub App installation, and MUST NOT merge inboxes, Ideas, candidates, listener state, or connection health across installations. A request that carries no signed-in session MUST be refused without revealing whether the named Idea exists. A request naming an Idea of another installation MUST be answered exactly as a request naming an identifier that exists nowhere, so the two are indistinguishable. Changing the current installation through the workspace switcher the `app-shell` capability presents SHALL replace the Idea-lane cards, the lane's listener state, the Load ideas options, and the reported connection health, and SHALL discard an open candidate review without saving anything.

#### Scenario: Happy path — the Idea lane shows only the current installation
- **GIVEN** installation A with saved Ideas and configured GitHub and Jira inboxes, and installation B with different Ideas and a configured GitLab inbox
- **AND** a signed-in user whose current installation is A
- **WHEN** they open the board
- **THEN** the Idea lane shows only A's Ideas
- **AND** Load ideas offers only A's GitHub and Jira inboxes plus Manual, and does not offer B's GitLab inbox
- **AND** the connection health lists only A's connections

#### Scenario: Failure — an unauthenticated request is refused without disclosure
- **GIVEN** a request that carries no signed-in session and names an Idea identifier that does exist
- **AND** a second such request naming an identifier that exists nowhere
- **WHEN** the two requests are answered
- **THEN** both are refused identically
- **AND** neither response returns a title, a source display key, a permalink, or a snapshot body
- **AND** neither response reveals whether the named Idea exists
- **AND** the viewer is shown the signed-out view the `app-shell` capability presents rather than any part of the board

#### Scenario: Failure — a cross-installation identifier is indistinguishable from an unknown one
- **GIVEN** a signed-in user whose current installation is A
- **AND** one request for an Idea belonging to installation B, and a second request for an identifier that belongs to no installation
- **WHEN** the two requests are answered
- **THEN** both requests are refused in the same way, with the same response
- **AND** nothing about B's Idea — its title, source display key, permalink, snapshot body, or existence — is revealed

#### Scenario: Edge case — switching installation replaces every intake-derived surface
- **GIVEN** a user working in installation A with an open candidate review holding four unsaved candidates
- **WHEN** their current installation becomes B
- **THEN** the Idea-lane cards, the lane's listener state, the Load ideas options, and the reported connection health are B's
- **AND** the open candidate review is discarded and none of its candidates is saved to A or to B
- **AND** A's and B's Ideas are not merged and A's inboxes are not offered under B

### Requirement: Present saved Ideas as Idea-lane cards

Every saved Idea of the current installation SHALL appear as a card in the board's Idea lane, and no saved Idea SHALL appear in any other lane. Each card SHALL carry the Idea's source, its source display key when one exists, the latest snapshot's title as literal text, and a freshness time taken from that snapshot's fetch time — or, for an Idea created in Jumphour, from its creation time. An imported card's evidence SHALL name where it came from, in the form "Captured from GitHub #814", with the key omitted when the source supplies none; an Idea created in Jumphour SHALL instead read "Created in Jumphour". An imported card's footer SHALL show the source's opened and updated dates in the form "Opened Sep 9 · updated Sep 14", showing only the date the source supplied when it supplied one of the two, and nothing at all when it supplied neither; an Idea created in Jumphour SHALL instead show its composed date in the form "Composed Sep 13". A date MUST NEVER be invented. A card MUST NOT show a repository, an owner, a relevance label, or an OpenSpec change name, and MUST NOT invent any of them. An external-host label SHALL appear only when the Idea's stored permalink is an `http` or `https` address. An Idea removed from Jumphour MUST be absent from the Idea lane for every viewer of that installation — which is a different operation from a single viewer hiding a card from their own board view.

#### Scenario: Happy path — an imported GitHub Idea appears in the Idea lane
- **GIVEN** a saved Idea captured from GitHub with the source display key `#814`, whose latest snapshot was fetched 14 minutes before the board was generated and whose stored permalink is an https address on `github.com`
- **AND** whose source supplied an opened date of September 9 and an updated date of September 14
- **WHEN** the board is displayed
- **THEN** the Idea lane shows a card with the "GitHub" badge, `#814`, "Snapshot 14 min ago", the snapshot's title, and the evidence "Captured from GitHub #814"
- **AND** the card's footer reads "Opened Sep 9 · updated Sep 14"
- **AND** the card shows the external-host label `github.com`
- **AND** the card shows no repository, no owner, no relevance label, and no OpenSpec change name
- **AND** the card appears in the Idea lane and in none of the OpenSpec change, In progress, or PR/MR lanes

#### Scenario: Happy path — an idea created in Jumphour appears without invented values
- **GIVEN** a saved Idea created in Jumphour on September 13 with no source display key and no permalink
- **WHEN** the board is displayed
- **THEN** the card shows the "Manual" badge and "Created in Jumphour" evidence
- **AND** its freshness time is its creation time and its footer reads "Composed Sep 13"
- **AND** it shows no source key, no repository, no owner, and no external-host indicator

#### Scenario: Failure — a removed Idea is absent for every viewer
- **GIVEN** two people viewing the same installation's board, both seeing a saved Idea in the Idea lane
- **WHEN** one of them removes that Idea from Jumphour
- **THEN** the card is absent from the Idea lane for both of them on their next board read
- **AND** removal is distinct from hiding a card from one's own board view, which affects only that viewer's browser and is reversible
- **AND** hiding a card in one browser leaves it visible to everyone else

#### Scenario: Edge case — the source supplied only one of the two dates
- **GIVEN** a saved Idea captured from GitHub whose source supplied an opened date of September 9 and no updated date, and another whose source supplied neither date
- **WHEN** the board is displayed
- **THEN** the first card's footer reads "Opened Sep 9"
- **AND** the second card shows no date in its footer at all
- **AND** neither card shows an invented opened or updated date

#### Scenario: Edge case — scheme case and surrounding whitespace do not hide the host
- **GIVEN** one Idea whose stored permalink is `HTTPS://github.com/acme/api-gateway/issues/814`, and another whose stored permalink is that same address with spaces around it
- **WHEN** the board is displayed
- **THEN** both cards show the external-host label `github.com`, because differing scheme case alone does not make a safe address unsafe
- **AND** surrounding whitespace alone does not hide the host either

### Requirement: Report Idea-lane listener state

The Idea lane SHALL report its listener state in text, and the OpenSpec change, In progress, and PR/MR lanes SHALL keep reporting that no listener is configured. When the Idea-lane listener is not running, or the installation has no configured inbox, the Idea lane SHALL read "Listener not configured" and MUST show no interval line and no last-heard time. When the listener is configured but no run has yet succeeded, the lane SHALL read "Listening every 5 min" and "Not heard yet". When the last run failed, or the next run is more than one interval overdue — exactly five minutes past due is not yet delayed, five minutes and one second past due is — the lane SHALL state that listening is delayed and, when a successful run is known, give its time in the form "Last successful listen 14 min ago", rather than presenting a stale healthy last-heard time. Otherwise the lane SHALL read "Listening every 5 min" together with its last-heard time, in the form "Last heard 2 min ago". Every one of these times MUST be computed against the board's generation time and MUST NOT be negative.

#### Scenario: Happy path — a healthy Idea listener
- **GIVEN** an installation with a configured inbox whose listener last succeeded 2 minutes before the board was generated
- **WHEN** the board is displayed
- **THEN** the Idea lane header reads "Listening every 5 min" and "Last heard 2 min ago"
- **AND** the OpenSpec change, In progress, and PR/MR lane headers each read "Listener not configured"

#### Scenario: Failure — a failing listener reports delayed rather than a stale healthy time
- **GIVEN** an Idea-lane listener whose most recent run failed and whose last successful run was 14 minutes before the board was generated
- **WHEN** the board is displayed
- **THEN** the Idea lane header states that listening is delayed and retrying, and gives the time as "Last successful listen 14 min ago"
- **AND** it does not present that time as a healthy last-heard time
- **AND** the delayed state is conveyed by the words, with color only as reinforcement

#### Scenario: Edge case — the listener is not running or no inbox is configured
- **GIVEN** an installation whose Idea-lane listener is not running, or which has no configured inbox
- **WHEN** the board is displayed
- **THEN** the Idea lane header reads "Listener not configured"
- **AND** it shows no interval line and no last-heard time
- **AND** the other three lane headers read "Listener not configured" as well

#### Scenario: Edge case — a configured listener that has never succeeded
- **GIVEN** an installation with a configured inbox whose listener has completed no successful run
- **WHEN** the board is displayed
- **THEN** the Idea lane header reads "Listening every 5 min" and "Not heard yet"
- **AND** it shows no last-heard duration and no fabricated success time

#### Scenario: Edge case — the overdue boundary between healthy and delayed
- **GIVEN** one board whose Idea-lane listener last ran successfully and whose next run is exactly five minutes past due
- **AND** a second board whose Idea-lane listener last ran successfully and whose next run is five minutes and one second past due
- **WHEN** each board is displayed
- **THEN** the first board's Idea lane header does not state that listening is delayed, and reads "Listening every 5 min" with its last-heard time
- **AND** the second board's Idea lane header states that listening is delayed
- **AND** the second board does not present the earlier success as a healthy last-heard time

#### Scenario: Edge case — a success recorded later than the board's generation time
- **GIVEN** an Idea-lane listener whose last successful run is recorded 40 seconds after the board's generation time
- **WHEN** the board is displayed
- **THEN** the Idea lane header reads "Last heard just now"
- **AND** it shows no negative and no future duration

### Requirement: Report inbox connection health

The system SHALL report exactly one connection entry per inbox configured for the current installation, using the status words `healthy`, `stale`, `delayed`, and `unreachable`. Ideas created in Jumphour MUST NEVER be listed as a connection. A connection whose last read failed — because the source was unreachable, errored, or rejected the connection's credential — SHALL be reported `unreachable` with retry available, and MUST return to a readable status by itself on its next successful read. A connection whose configuration is unusable before any read is attempted SHALL be reported `unreachable` with retry unavailable and the visible reason "This connection is misconfigured. An operator must fix its configuration." A rejected credential MUST be reported as a failed read, never as a misconfiguration and never as an outcome of its own. Retry SHALL be available for a `stale`, a `delayed`, or a could-not-be-read connection, SHALL be unavailable with its reason visible for a misconfigured one, and SHALL be absent entirely for a `healthy` one. A `healthy` entry's summary line SHALL read "Reading every 5 min" while the Idea-lane listener is running and "Read on demand" while it is not. A reachable connection SHALL be reported `delayed` while the Idea-lane listener is delayed, and `stale` when its last successful read is more than fifteen minutes old; a connection that has not yet been read at all MUST be reported `stale` with the summary "Not read yet", and any connection that has never been read successfully MUST state that no successful snapshot has been captured yet rather than report an age of zero. When the Idea-lane listener is not running, a `stale` entry MUST say so — "No listener is running. This inbox is read only when you choose Load ideas." — so the entry and the lane's "Listener not configured" read as one cause. Retry SHALL perform an immediate read of that one inbox, SHALL save nothing, and SHALL show no candidates. No line MAY describe the operation as synchronization, and no state MAY offer a login, OAuth, credential-entry, or connection-editing control. When the installation has no configured inbox the view SHALL state that no sources are connected and list no entry. Banner copy for a failing connection is the `source-health` capability's and MUST be used verbatim.

#### Scenario: Happy path — one entry per configured inbox with distinguishable status words
- **GIVEN** an installation with configured GitHub, GitLab, and Jira inboxes whose Idea-lane listener is not running, so every read was made on demand
- **AND** GitHub was read successfully 1 minute ago, GitLab's last successful read was 40 minutes ago, and Jira's last read failed
- **WHEN** the user opens the connection health view
- **THEN** exactly three entries are listed: GitHub as `healthy`, GitLab as `stale`, and Jira as `unreachable`
- **AND** each status is legible with color removed, because the status word carries the meaning
- **AND** no line describes the operation as a sync or implies a write back to the source
- **AND** the GitLab entry states "No listener is running. This inbox is read only when you choose Load ideas." and offers retry, while the `healthy` GitHub entry offers no retry control at all
- **AND** the GitHub entry's summary line reads "Read on demand", because no listener is running
- **AND** Ideas created in Jumphour are not listed as a connection

#### Scenario: Happy path — retry reads one inbox and saves nothing
- **GIVEN** an unreachable GitHub connection whose retry is available
- **WHEN** the user activates the retry for that connection
- **THEN** exactly that one inbox is read immediately
- **AND** no Idea and no snapshot is created, and no candidate list is shown
- **AND** nothing is written to GitHub
- **AND** the GitHub connection's health records the outcome of that read

#### Scenario: Failure — a Jira failure uses the source-health banner copy
- **GIVEN** a configured Jira inbox scoped to `Payments` whose read failed
- **WHEN** the board renders
- **THEN** the banner title reads "Jira via MCP is unavailable"
- **AND** the body reads "We couldn't refresh Jira snapshots for Payments. Your last captured Jira ideas are still shown."
- **AND** the hint reads "Check the MCP connection or try again."
- **AND** the only actions offered are "Retry Jira source" and "View connection details"
- **AND** the Jira Ideas captured before the failure remain in the Idea lane
- **AND** no Jira login form, OAuth step, or API token field is offered

#### Scenario: Failure — a failing GitHub connection uses the parallel banner copy
- **GIVEN** a configured GitHub inbox scoped to `acme/api-gateway` whose last read failed after an earlier success
- **WHEN** the board renders
- **THEN** the banner title reads "GitHub is unavailable"
- **AND** the body reads "We couldn't refresh GitHub snapshots for acme/api-gateway. Your last captured GitHub ideas are still shown."
- **AND** the hint reads "Check the MCP connection or try again." and its retry action reads "Retry GitHub source"
- **AND** the banner also names the time of that connection's last successful snapshot, as every failing connection's banner does
- **AND** the GitHub Ideas captured before the failure remain in the Idea lane

#### Scenario: Failure — a misconfigured connection cannot be retried
- **GIVEN** a configured inbox whose configuration is unusable
- **WHEN** the user opens the connection health view
- **THEN** that entry is reported `unreachable` and states that an operator must fix the connection's configuration
- **AND** its retry control is disabled with the visible reason "This connection is misconfigured. An operator must fix its configuration."
- **AND** no credential field, sign-in step, or connection-editing control is offered in its place

#### Scenario: Edge case — a newly configured connection that has not been read yet
- **GIVEN** a GitLab inbox that was configured moments ago and has not been read at all, in an installation whose Idea-lane listener is running
- **WHEN** the user opens the connection health view
- **THEN** its entry is reported `stale` with the summary "Not read yet"
- **AND** it offers retry, and activating retry reads that one inbox immediately
- **AND** it shows no last-success time and no "0 minutes ago"

#### Scenario: Edge case — a connection that has never been read successfully
- **GIVEN** a configured GitHub inbox scoped to `acme/api-gateway` that has never completed a successful read and whose last read failed
- **WHEN** the user opens the connection health view
- **THEN** its entry states that no successful snapshot has been captured yet
- **AND** it shows no "0 minutes ago" and no fabricated last-success time
- **AND** the board's banner for that failing connection reads "No successful snapshot has been captured for acme/api-gateway yet." in place of a last-success time

#### Scenario: Edge case — the staleness and lane-delay boundaries
- **GIVEN** an Idea-lane listener that is running and is not delayed
- **AND** a reachable inbox whose last successful read was 14 minutes before the board's generation time, and another reachable inbox whose last successful read was 16 minutes before it
- **WHEN** the user opens the connection health view
- **THEN** the first is reported `healthy` and the second `stale`, both computed against the board's generation time
- **AND** the `healthy` entry's summary line reads "Reading every 5 min", because the listener is running
- **AND** while the Idea-lane listener is itself delayed, a reachable connection is reported `delayed` instead of `healthy`

#### Scenario: Edge case — no inbox is configured
- **GIVEN** an installation with no configured inbox
- **WHEN** the user opens the connection health view
- **THEN** the view states that no sources are connected
- **AND** it lists no connection entry
- **AND** it offers no connect, sign-in, or credential-entry control
