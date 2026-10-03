## Purpose

Reads a GitHub repository’s default branch and OpenSpec layout so later promotion and launches can fail closed instead of inventing specification files.

## Requirements

### Requirement: Discover the default branch from GitHub

For each accessible repository, the system SHALL read GitHub’s default branch (name and tip commit SHA when GitHub returns them) and include those facts in the discovery report. GitHub is authoritative for the default branch.

#### Scenario: Happy path — default branch is reported
- **GIVEN** an accessible repository whose GitHub default branch is `main` at commit SHA `abc123`
- **WHEN** the system runs discovery for that repository
- **THEN** the discovery report includes default branch `main` and tip SHA `abc123`

#### Scenario: Failure — repository metadata cannot be read
- **GIVEN** an accessible-looking repository whose metadata GitHub refuses or fails to return
- **WHEN** the system runs discovery
- **THEN** the report does not invent a default branch name
- **AND** the OpenSpec support status is `permission-blocked` or otherwise unavailable with the GitHub error explained

#### Scenario: Edge case — default branch is not `main` or `master`
- **GIVEN** a repository whose GitHub default branch is `trunk`
- **WHEN** the system runs discovery
- **THEN** the report’s default branch is `trunk`
- **AND** OpenSpec files are looked up on `trunk`, not on `main`

### Requirement: Classify OpenSpec support from the default branch

The system SHALL classify OpenSpec support from the repository default branch using GitHub-canonical status values `supported`, `unsupported`, or `permission-blocked`. Status MUST be computed once at the discovery boundary; every consumer MUST read that status rather than re-parsing GitHub contents independently.

A repository is `supported` only when all of the following are true on the default branch:
- a file exists at exactly `openspec/config.yaml`
- that file is parseable as YAML
- a conventional change directory `openspec/changes/` exists

Otherwise, if GitHub contents can be read, the status is `unsupported`. If GitHub forbids or fails the contents read that discovery requires, the status is `permission-blocked`.

#### Scenario: Happy path — config and change layout exist
- **GIVEN** a repository default branch that contains parseable `openspec/config.yaml` and a directory `openspec/changes/`
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `supported`
- **AND** the report includes the config path `openspec/config.yaml`
- **AND** it includes the YAML `schema` value when that field is present

#### Scenario: Failure — GitHub contents read is forbidden
- **GIVEN** a repository whose metadata can be read
- **AND** GitHub forbids reading `openspec/config.yaml` or `openspec/changes/` because of missing permission
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `permission-blocked`
- **AND** the report names the missing GitHub permission or access error
- **AND** the system does not create files to make the repository look supported

#### Scenario: Edge case — `openspec/config.yml` exists without `openspec/config.yaml`
- **GIVEN** a repository whose default branch has `openspec/config.yml` and does not have `openspec/config.yaml`
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `unsupported`
- **AND** the reason states that `openspec/config.yaml` was not found
- **AND** the system does not treat `config.yml` as equivalent

### Requirement: Treat missing or invalid OpenSpec layout as unsupported

When GitHub contents can be read and the support rule is not met, the system SHALL report `unsupported` with a concrete reason. It MUST NOT create `openspec/config.yaml`, a change directory, or any other OpenSpec files.

#### Scenario: Happy path — repository has no OpenSpec files
- **GIVEN** a readable repository whose default branch has no `openspec/config.yaml`
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `unsupported`
- **AND** the repository remains listed
- **AND** no OpenSpec files are written

#### Scenario: Failure — config file is not parseable YAML
- **GIVEN** a default branch that contains `openspec/config.yaml` whose contents are not parseable YAML
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `unsupported`
- **AND** the reason states that the config could not be parsed
- **AND** the system does not invent a schema or change layout

#### Scenario: Edge case — config exists without `openspec/changes/`
- **GIVEN** a default branch that contains parseable `openspec/config.yaml` and does not contain a directory `openspec/changes/`
- **WHEN** the system runs discovery
- **THEN** OpenSpec support status is `unsupported`
- **AND** the reason states that the conventional change layout was not found

### Requirement: Keep discovery read-only

OpenSpec discovery SHALL use GitHub read operations only. It MUST NOT create or update branches, commits, files, or pull requests, including when status is `unsupported` or `permission-blocked`.

#### Scenario: Happy path — supported repository is not mutated
- **GIVEN** a repository that qualifies as `supported`
- **WHEN** discovery completes
- **THEN** GitHub repository contents, refs, and pull requests are unchanged by Jumphour

#### Scenario: Failure — unsupported repository is not “fixed” by writing files
- **GIVEN** a repository that qualifies as `unsupported`
- **WHEN** a user views the discovery result
- **THEN** the system does not create OpenSpec files or an initialization commit
- **AND** it explains what repository configuration is required

#### Scenario: Edge case — concurrent discovery runs do not write
- **GIVEN** two discovery runs for the same repository overlapping in time
- **WHEN** both complete
- **THEN** neither run writes to GitHub
- **AND** both report the same canonical support status for the same GitHub contents

### Requirement: Scope discovery reports to the installation

A discovery report SHALL belong to one GitHub App installation and one GitHub-canonical repository identity. The system MUST NOT reuse a report from another installation or attach it to a different repository identity.

#### Scenario: Happy path — report is stored for the installation and repository
- **GIVEN** installation A and canonical repository `acme/api-gateway`
- **WHEN** discovery completes
- **THEN** the report is available to authorized users of installation A for that repository

#### Scenario: Failure — report from another installation is not reused
- **GIVEN** a discovery report for `acme/api-gateway` under installation A
- **WHEN** an authorized user of installation B requests discovery for a repository GitHub also names `acme/api-gateway`
- **THEN** the system does not return installation A’s report
- **AND** it runs or loads discovery in installation B’s tenancy only

#### Scenario: Edge case — renamed GitHub full_name keeps one identity
- **GIVEN** a stored report keyed by GitHub repository id
- **AND** GitHub later returns a different `owner/name` for that same id
- **WHEN** discovery is shown or refreshed
- **THEN** the system treats it as the same repository
- **AND** it does not create a second repository record from the new name alone
