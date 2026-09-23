## Purpose

Lets the team review every designed interface state against the Claude Design prototype using clearly labeled fixture data, while guaranteeing that fixture data can never appear on a surface a real user relies on.

## ADDED Requirements

### Requirement: Serve preview pages only when explicitly enabled

The system SHALL serve UI preview pages only when the operator has explicitly enabled the preview with the exact setting value `1`. Preview MUST be disabled by default in every environment, including local development. When preview is disabled, every preview page MUST respond as not found and MUST NOT include fixture content in its response.

#### Scenario: Happy path — preview is enabled
- **GIVEN** an environment in which the preview setting is exactly `1`
- **WHEN** a visitor opens the board preview page
- **THEN** the page renders the board with fixture cards
- **AND** a persistent label reading "Preview — fixture data" is visible on the page

#### Scenario: Failure — preview is not enabled
- **GIVEN** an environment in which the preview setting is absent
- **WHEN** a visitor opens any preview page, including the preview index and the board preview
- **THEN** each responds as not found
- **AND** no fixture card title, repository name, or person name appears in the response

#### Scenario: Edge case — setting has a truthy-looking value other than `1`
- **GIVEN** an environment in which the preview setting is `true`, `yes`, `0`, or ` 1 ` with surrounding spaces
- **WHEN** a visitor opens the board preview page
- **THEN** it responds as not found

### Requirement: Keep fixture data out of production surfaces

Fixture data SHALL be reachable only from preview pages and automated tests. A production surface MUST render only data belonging to the signed-in user's installation. The automated test suite MUST fail if a production surface or server module depends on fixture data, and MUST fail if any preview page can be served while preview is disabled.

#### Scenario: Happy path — production board shows only real data
- **GIVEN** a signed-in user whose installation has two accessible repositories and no ideas
- **WHEN** they open the signed-in landing view
- **THEN** the repository filter offers exactly those two repositories
- **AND** the board shows zero cards and none of the fixture cards, repositories, or people

#### Scenario: Failure — a production module depends on fixtures
- **GIVEN** a change that makes a production surface or server module depend on fixture data
- **WHEN** the automated test suite runs
- **THEN** the suite fails and names the offending module

#### Scenario: Failure — a preview page omits the enablement check
- **GIVEN** a change that adds a preview page that does not check whether preview is enabled
- **WHEN** the automated test suite runs
- **THEN** the suite fails and names the unguarded page

#### Scenario: Edge case — preview is enabled where real data also exists
- **GIVEN** an environment with preview enabled and a signed-in user who has real repositories
- **WHEN** they open the board preview page and then the signed-in landing view
- **THEN** the preview page shows only fixture data under the "Preview — fixture data" label
- **AND** the landing view shows only that user's real installation data

### Requirement: Reproduce the designed board scenarios by name

The board preview SHALL reproduce these named scenarios from the prototype: `populated`, `loading`, `empty`, `filtered-empty`, `source-error`, and `jira-failed`. The page MUST show which scenario is displayed. Scenario names MUST be matched without regard to letter case or surrounding whitespace, and an unrecognized name MUST fall back to `populated`.

#### Scenario: Happy path — populated scenario
- **GIVEN** preview is enabled
- **WHEN** a visitor opens the board preview with scenario `populated`
- **THEN** the four lanes show the prototype's thirteen sample cards distributed as four Idea, three OpenSpec change, three In progress, and three PR/MR
- **AND** the page states that the `populated` scenario is displayed

#### Scenario: Happy path — degraded-source scenarios
- **GIVEN** preview is enabled
- **WHEN** a visitor opens the board preview with scenario `source-error`
- **THEN** the In progress lane header states that listening is delayed and retrying
- **AND** the PR/MR lane header states that the last successful listen was 48 min ago
- **AND** the existing cards remain visible

#### Scenario: Failure — unrecognized scenario name
- **GIVEN** preview is enabled
- **WHEN** a visitor opens the board preview with scenario `does-not-exist`
- **THEN** the `populated` scenario is rendered
- **AND** the page states that `populated` is displayed

#### Scenario: Edge case — scenario name differs in case or whitespace
- **GIVEN** preview is enabled
- **WHEN** a visitor opens the board preview with scenario `Loading`, or ` loading ` with surrounding spaces
- **THEN** the `loading` scenario is rendered in both cases
