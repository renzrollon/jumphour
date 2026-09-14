## Purpose

Lets a team install Jumphour as a GitHub App for selected repositories, sign in with GitHub, and see only the installation-scoped repositories they can access.

## ADDED Requirements

### Requirement: Operate through a shareable GitHub App installation

The system SHALL operate GitHub repository access through a shareable GitHub App installation on selected repositories, not through a personal access token as the product’s GitHub credential.

#### Scenario: Happy path — administrator installs for selected repositories
- **GIVEN** an organization administrator who can install GitHub Apps
- **WHEN** they install the Jumphour GitHub App and select a subset of organization repositories
- **THEN** the system records that installation and its selected repositories
- **AND** authorized users can use only those selected repositories through Jumphour

#### Scenario: Failure — App is not installed
- **GIVEN** a GitHub user who has not had the Jumphour App installed for any repository they can access
- **WHEN** they sign in
- **THEN** the system does not list any repositories as Jumphour-accessible
- **AND** it explains that a GitHub App installation is required

#### Scenario: Edge case — repository outside the installation
- **GIVEN** an installation that includes `acme/api-gateway` and does not include `acme/secret-ledger`
- **WHEN** a signed-in user requests `acme/secret-ledger` as a Jumphour repository
- **THEN** the system refuses the request
- **AND** it does not read that repository through the App

### Requirement: Authenticate users with GitHub identity

The system SHALL authenticate end users as GitHub users bound to an App installation. It MUST NOT introduce a product-specific role model for GitHub repository access in this change.

#### Scenario: Happy path — GitHub user signs in
- **GIVEN** a valid Jumphour GitHub App installation
- **AND** a GitHub user who can access at least one installed repository
- **WHEN** they complete GitHub sign-in
- **THEN** the system establishes a session for that GitHub user
- **AND** subsequent repository listing is scoped to that user and installation

#### Scenario: Failure — GitHub sign-in is denied or cancelled
- **GIVEN** an unauthenticated visitor
- **WHEN** GitHub sign-in is denied or cancelled
- **THEN** the system does not create a signed-in session
- **AND** it does not persist GitHub credentials from the failed attempt

#### Scenario: Edge case — GitHub user has no overlapping repository access
- **GIVEN** a valid installation on selected repositories
- **AND** a GitHub user who can sign in but cannot access any installed repository
- **WHEN** they complete GitHub sign-in
- **THEN** the system may establish a session
- **AND** the accessible-repository list is empty
- **AND** the empty state explains that GitHub repository access, not a Jumphour role, is missing

### Requirement: List only installation-scoped accessible repositories

The system SHALL list a repository for a signed-in user only when it is in the GitHub App installation **and** GitHub reports that the user can access it. Repository identity MUST be the GitHub-canonical repository identity (stable GitHub repository id and canonical `owner/name`), resolved at the GitHub boundary, not a raw user-typed string compared locally.

#### Scenario: Happy path — intersection of installation and user access
- **GIVEN** an installation that includes `acme/api-gateway` and `acme/customer-web`
- **AND** a signed-in GitHub user who can access `acme/api-gateway` but not `acme/customer-web`
- **WHEN** they view accessible repositories
- **THEN** the system lists `acme/api-gateway`
- **AND** it does not list `acme/customer-web`

#### Scenario: Failure — GitHub listing is unavailable
- **GIVEN** a signed-in user bound to an installation
- **WHEN** GitHub refuses or fails the repository listing request
- **THEN** the system does not invent a repository list
- **AND** it shows that GitHub repository listing failed and can be retried

#### Scenario: Edge case — mixed-case owner or name resolves to one canonical repository
- **GIVEN** GitHub’s canonical repository identity is `acme/api-gateway`
- **WHEN** a signed-in user refers to that repository as `Acme/API-Gateway` or `acme/api-gateway`
- **THEN** the system resolves both to the same GitHub-canonical repository identity
- **AND** later readers of that identity see one repository, not two

### Requirement: Fail closed when required GitHub permissions are missing

The GitHub App SHALL request repository permissions `metadata: read`, `contents: write`, and `pull_requests: write`. This change MUST NOT create branches, commits, files, or pull requests. If an installation lacks a required permission, the system MUST identify the missing GitHub permission and MUST NOT attempt a partial GitHub write.

#### Scenario: Happy path — required permissions are present
- **GIVEN** an installation that grants `metadata: read`, `contents: write`, and `pull_requests: write`
- **WHEN** a signed-in user lists repositories and requests discovery
- **THEN** the system proceeds with read-only GitHub operations
- **AND** it does not create a branch, commit, file, or pull request

#### Scenario: Failure — required permission is missing
- **GIVEN** an installation that lacks `contents` write or `pull_requests` write
- **WHEN** a signed-in user views that installation’s repositories
- **THEN** the system reports which required GitHub permission is missing
- **AND** it does not attempt a GitHub write to compensate

#### Scenario: Edge case — permission revoked after install
- **GIVEN** an installation that previously granted the required permissions
- **AND** those permissions were later revoked or reduced
- **WHEN** the system next checks installation permissions
- **THEN** it reports the current missing permission
- **AND** it does not reuse a cached “permissions sufficient” result to attempt a write

### Requirement: Isolate data by GitHub App installation

The system SHALL treat a GitHub App installation as the tenancy boundary. Records, repository lists, and discovery reports for one installation MUST NOT be visible in another installation.

#### Scenario: Happy path — user sees only their installation
- **GIVEN** installation A with repository `acme/api-gateway`
- **AND** a signed-in user working in installation A
- **WHEN** they view accessible repositories
- **THEN** they see only installation A’s accessible repositories

#### Scenario: Failure — cross-installation read is refused
- **GIVEN** installation A and installation B
- **AND** a signed-in user whose current context is installation A
- **WHEN** they request repository or discovery records that belong to installation B
- **THEN** the system refuses the request
- **AND** it does not return installation B’s repository names, discovery reports, or identifiers

#### Scenario: Edge case — same GitHub user in two installations
- **GIVEN** the same GitHub user is authorized in installation A and installation B
- **WHEN** they switch from A to B
- **THEN** the repository list and discovery reports are those of B only
- **AND** A and B are not merged into one list

### Requirement: Present a thin signed-in repository and discovery surface

The system SHALL present a signed-in view of accessible repositories and each repository’s discovery status. It MUST NOT present the four-column Idea / OpenSpec change / In progress / PR/MR board in this change.

#### Scenario: Happy path — repository list with discovery status
- **GIVEN** a signed-in user with at least one accessible repository
- **WHEN** they open the signed-in Jumphour surface
- **THEN** they see each accessible repository with its discovery status
- **AND** they do not see workflow board columns

#### Scenario: Failure — installation has no accessible repositories
- **GIVEN** a signed-in user whose installation/user intersection is empty
- **WHEN** they open the signed-in surface
- **THEN** they see an empty repository list
- **AND** the copy explains App installation and GitHub access, not a missing board

#### Scenario: Edge case — discovery status is shown without promoting
- **GIVEN** a listed repository whose discovery status is `unsupported` or `permission-blocked`
- **WHEN** the user views that repository
- **THEN** the status and reason are visible
- **AND** the system offers no action that writes OpenSpec files or opens a pull request
