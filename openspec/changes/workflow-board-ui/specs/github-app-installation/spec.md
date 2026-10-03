## MODIFIED Requirements

### Requirement: Present a thin signed-in repository and discovery surface

The system SHALL present a signed-in view of accessible repositories and each repository’s discovery status, and that view SHALL remain reachable from the signed-in navigation when the workflow board is the signed-in landing view. The repository and discovery view MUST NOT itself render the Idea / OpenSpec change / In progress / PR/MR board columns, and it MUST NOT offer any action that writes OpenSpec files or opens a pull request. Refreshing repositories and discovery SHALL return the user to the repository and discovery view.

#### Scenario: Happy path — repository list with discovery status
- **GIVEN** a signed-in user with at least one accessible repository
- **WHEN** they open the repository and discovery view
- **THEN** they see each accessible repository with its discovery status
- **AND** they do not see workflow board columns on that view

#### Scenario: Happy path — repository view is reachable from the board
- **GIVEN** a signed-in user whose landing view is the workflow board
- **WHEN** they choose Repositories in the signed-in navigation
- **THEN** the repository and discovery view opens
- **AND** choosing Board returns them to the workflow board

#### Scenario: Failure — installation has no accessible repositories
- **GIVEN** a signed-in user whose installation/user intersection is empty
- **WHEN** they open the repository and discovery view
- **THEN** they see an empty repository list
- **AND** the copy explains App installation and GitHub access, not a missing board

#### Scenario: Failure — refresh cannot start
- **GIVEN** a signed-in user on the repository and discovery view
- **AND** GitHub sign-in is not configured, or the session has no installation selected
- **WHEN** they request a refresh
- **THEN** they are returned to the repository and discovery view showing the rows already stored
- **AND** they are not sent to the workflow board

#### Scenario: Edge case — discovery status is shown without promoting
- **GIVEN** a listed repository whose discovery status is `unsupported` or `permission-blocked`
- **WHEN** the user views that repository
- **THEN** the status and reason are visible
- **AND** the system offers no action that writes OpenSpec files or opens a pull request

#### Scenario: Edge case — refresh round trip returns to the repository view
- **GIVEN** a signed-in user on the repository and discovery view with an installation selected
- **WHEN** they request a refresh and the GitHub round trip completes
- **THEN** they land on the repository and discovery view, not the workflow board
- **AND** the view shows the repositories and discovery reports the refresh stored
