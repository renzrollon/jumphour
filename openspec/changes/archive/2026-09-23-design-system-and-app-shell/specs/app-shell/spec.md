## Purpose

Provides the persistent frame every signed-in Jumphour view sits inside — a top app bar carrying the product mark, the real workspace identity, appearance controls, settings, and the signed-in account — together with the signed-out entry view, the landing behavior of a completed or refused GitHub sign-in, a local-only sign-out, and the responsive collapse that keeps settings and the account reachable on a phone.

## ADDED Requirements

### Requirement: Frame every signed-in view in one top app bar

The system SHALL present a single top app bar on every signed-in view, containing the Jumphour mark and wordmark, the workspace label for the current GitHub App installation, a region reserved for search, the theme control, the cats toggle, an entry to the settings surface, and an account menu. The bar SHALL remain visible while the content below it scrolls. No signed-in view SHALL render a second wordmark, theme control, cats toggle, settings entry, or account menu of its own.

#### Scenario: Happy path — the bar carries every element once
- **GIVEN** a signed-in viewer on a wide screen
- **WHEN** the signed-in surface renders
- **THEN** the top app bar shows the mark and wordmark, the workspace label, the search region, the theme control, the cats toggle, the settings entry, and the account menu
- **AND** each appears exactly once on the page

#### Scenario: Failure — a bar element has no data to show
- **GIVEN** a signed-in viewer whose session names no installation
- **WHEN** the signed-in surface renders
- **THEN** the top app bar still renders with its remaining controls operable
- **AND** the element with no data states its condition in words rather than being omitted or left blank

#### Scenario: Edge case — the content area scrolls
- **GIVEN** a signed-in view whose content is taller than the viewport
- **WHEN** the viewer scrolls to the bottom of the content
- **THEN** the top app bar is still visible and its controls are still operable
- **AND** the page as a whole does not scroll horizontally

### Requirement: Name the workspace from the real GitHub App installation

The system SHALL label the workspace with the account login of the GitHub App installation the current session is bound to. When the session names no installation, or the named installation has no stored record, it SHALL show a neutral statement that no workspace is selected. It MUST NOT display an invented or placeholder workspace name, and it MUST NOT display a numeric installation identifier as the label. A workspace switcher SHALL be offered only when two or more installations are known for the signed-in user; otherwise the label SHALL be static and non-interactive.

#### Scenario: Happy path — the label is the installation account
- **GIVEN** a signed-in session bound to an installation whose account login is `acme`
- **WHEN** the signed-in surface renders
- **THEN** the workspace label reads `acme`
- **AND** because that is the only installation known for this user, the label is static and offers no switcher

#### Scenario: Failure — no installation is bound or stored
- **GIVEN** a signed-in session that names no installation, or that names one for which no record is stored
- **WHEN** the signed-in surface renders
- **THEN** the workspace label states that no workspace is selected
- **AND** it shows no invented name and no numeric identifier

#### Scenario: Edge case — the user is known in two installations
- **GIVEN** a signed-in user for whom two installations are known
- **WHEN** the signed-in surface renders
- **THEN** the workspace element becomes a switcher naming each installation by its account login
- **AND** the label always names the installation whose repositories the page below is showing, so the two never disagree

### Requirement: Identify the signed-in account and offer sign out

The system SHALL present an account menu that shows the signed-in user's GitHub login and offers a sign-out action. When the login cannot be read, it SHALL show a neutral account label and still offer sign out; it MUST NOT invent a name and MUST NOT show a numeric user identifier. The account menu SHALL NOT offer team administration, billing, credential entry, or any source-authentication setup.

#### Scenario: Happy path — the menu names the signed-in GitHub user
- **GIVEN** a signed-in session for the GitHub user `octocat`
- **WHEN** the viewer opens the account menu
- **THEN** it shows `octocat` as the signed-in account
- **AND** it offers sign out

#### Scenario: Failure — the account login cannot be read
- **GIVEN** a signed-in session whose GitHub user record cannot be read
- **WHEN** the viewer opens the account menu
- **THEN** it shows a neutral account label rather than a name, a placeholder person, or a numeric identifier
- **AND** sign out is still offered and still works

#### Scenario: Edge case — the menu's scope stays narrow
- **GIVEN** an open account menu
- **WHEN** the viewer reads every item in it
- **THEN** the items are limited to identifying the signed-in account and signing out
- **AND** there is no team administration, billing, token entry, or source-credential setup anywhere in it

### Requirement: Offer GitHub sign-in on a signed-out view in the same visual system

The system SHALL present a signed-out view built from the same tokens, typography, and controls as the signed-in application, offering exactly one action: sign in with GitHub. When GitHub sign-in is not configured for the deployment, the view SHALL say so plainly and SHALL NOT offer a sign-in action that cannot work. The view MUST NOT display repository data, discovery data, or board content, and MUST NOT display any configuration value, client identifier, or secret.

#### Scenario: Happy path — a visitor is offered GitHub sign-in
- **GIVEN** a visitor with no session and a deployment where GitHub sign-in is configured
- **WHEN** they open Jumphour
- **THEN** they see the signed-out view in the product's visual system with a single sign-in with GitHub action
- **AND** they see no repository rows, no discovery status, and no board content

#### Scenario: Failure — GitHub sign-in is not configured
- **GIVEN** a deployment where GitHub sign-in is not configured
- **WHEN** a visitor opens Jumphour
- **THEN** the view explains that GitHub sign-in is not configured for this deployment
- **AND** it offers no sign-in action, and it names no configuration value or secret

#### Scenario: Edge case — the visitor has a stored appearance choice
- **GIVEN** a visitor with no session whose stored theme choice is Dark
- **WHEN** they open Jumphour
- **THEN** the signed-out view renders in the Dark presentation from its first painted frame
- **AND** it is legible and meets the same contrast floor as the signed-in application

### Requirement: Land a completed sign-in on the signed-in surface

The system SHALL return the browser to the signed-in landing view, rendered inside the application shell, when a GitHub sign-in completes successfully, and SHALL establish the session at the same time. It MUST NOT leave the viewer on a machine-readable response body. When sign-in is denied, cancelled, or fails, the system SHALL return the browser to the signed-out view with a visible notice that sign-in did not complete, SHALL NOT establish a session, and SHALL NOT include any code, token, secret, or credential value in that notice.

#### Scenario: Happy path — authorizing lands on the application
- **GIVEN** a visitor who starts GitHub sign-in and authorizes Jumphour
- **WHEN** GitHub returns them to the application
- **THEN** their browser lands on the signed-in landing view inside the shell
- **AND** a session is established, so a later load of the same address is still signed in
- **AND** at no point is a machine-readable response body shown as the destination

#### Scenario: Failure — sign-in is denied or fails
- **GIVEN** a visitor who declines the GitHub authorization, or whose sign-in fails
- **WHEN** GitHub returns them to the application
- **THEN** their browser lands on the signed-out view with a visible notice that sign-in did not complete
- **AND** no session exists
- **AND** the notice contains no authorization code, token, client identifier, or other secret, and no raw internal error text

#### Scenario: Edge case — the round trip was started by Refresh
- **GIVEN** a signed-in user who invokes Refresh, which sends them through GitHub and back
- **WHEN** GitHub returns them to the application
- **THEN** their browser lands on the repository and discovery view inside the shell, showing the refreshed repository and discovery rows
- **AND** it does not land on a machine-readable response body

### Requirement: End the session locally on sign out

The system SHALL, when the viewer signs out, end the session record, clear the session from the browser, and return the browser to the signed-out view. Sign out MUST NOT call GitHub, MUST NOT revoke or alter the GitHub App installation or the user's authorization of it, and MUST NOT write to any source system. The viewer's stored appearance choices SHALL survive sign out.

#### Scenario: Happy path — signing out returns to the signed-out view
- **GIVEN** a signed-in viewer
- **WHEN** they choose sign out from the account menu
- **THEN** their browser lands on the signed-out view
- **AND** loading the signed-in address again shows the signed-out view, because no session remains
- **AND** no GitHub request is made as part of signing out

#### Scenario: Failure — signing out with no live session
- **GIVEN** a browser holding a session value that no longer identifies a session
- **WHEN** sign out is invoked
- **THEN** the browser still lands on the signed-out view with the session value cleared
- **AND** no error surface is shown and no GitHub request is made

#### Scenario: Edge case — the installation and the appearance choice survive
- **GIVEN** a viewer with the Dark theme chosen who signs out
- **WHEN** they sign in again with GitHub
- **THEN** they are not asked to reinstall the GitHub App, because the installation was untouched
- **AND** both the signed-out view and the signed-in surface render in the Dark presentation throughout

### Requirement: Present appearance settings in a settings surface

The system SHALL offer a settings surface, opened from the top app bar, that presents the theme choice and the cats toggle with an accessible description of what the cats layer does. It MUST NOT present credential entry, source authentication setup, billing, or team administration.

#### Scenario: Happy path — settings shows appearance and cats
- **GIVEN** a signed-in viewer
- **WHEN** they open the settings surface
- **THEN** it offers the three theme choices with the current one marked
- **AND** it offers the cats toggle with a description stating that it adds subtle cat accents without changing the board

#### Scenario: Failure — settings is not a credential surface
- **GIVEN** an open settings surface
- **WHEN** the viewer reads every control in it
- **THEN** there is no field for a token, password, or connection secret, and no source sign-in or authorization wizard
- **AND** there is no billing or team administration section

#### Scenario: Edge case — settings agrees with the top app bar
- **GIVEN** a viewer who has chosen System with cats on
- **WHEN** they open the settings surface
- **THEN** it shows System chosen and cats on, matching the top app bar's controls exactly
- **AND** changing either one there updates the top app bar's controls without a reload

### Requirement: Keep settings and the account reachable on a narrow viewport

The system SHALL adapt the top app bar to the viewport's width alone. Below the narrow breakpoint it MAY move the workspace label, the search region, the theme control, and the cats toggle out of the bar, but the settings entry and the account menu SHALL remain in the bar, and both appearance choices SHALL remain changeable from the settings surface. The bar MUST NOT overflow horizontally, overlap its own controls, or push a control out of reach at any width.

#### Scenario: Happy path — the narrow bar still reaches settings and the account
- **GIVEN** a viewer on a viewport narrower than the narrow breakpoint
- **WHEN** the signed-in surface renders
- **THEN** the top app bar shows the mark and wordmark, the settings entry, and the account menu
- **AND** the theme choice and the cats toggle are both changeable from the settings surface

#### Scenario: Failure — a very narrow viewport with a long workspace name
- **GIVEN** a very narrow viewport and an installation whose account login is long
- **WHEN** the signed-in surface renders
- **THEN** the label is shortened to fit and its full value remains available to the viewer
- **AND** no control is overlapped, clipped, or pushed off-screen, and the bar does not scroll horizontally

#### Scenario: Edge case — the viewport is resized while settings is open
- **GIVEN** a viewer with the settings surface open on a wide viewport
- **WHEN** they narrow the viewport past the breakpoint and then widen it again
- **THEN** the settings surface and every control in it remain operable at each width
- **AND** the stored theme and cats choices are unchanged and the viewer remains signed in

### Requirement: Preserve the repository and discovery surface inside the shell

The system SHALL present the repository and discovery view inside the application shell: each accessible repository with its canonical name, default branch, discovery status, and reason, together with its empty-state explanation and its Refresh action. Placing the view inside the shell MUST NOT change which rows are shown, what the empty state says, or what Refresh reads. The repository and discovery view MUST NOT itself present Idea / OpenSpec change / In progress / PR/MR board columns.

#### Scenario: Happy path — the repository rows are unchanged inside the shell
- **GIVEN** a signed-in user whose installation exposes accessible repositories
- **WHEN** they open the repository and discovery view
- **THEN** they see each accessible repository with its canonical name, default branch, discovery status, and reason, exactly as stored
- **AND** those rows are rendered inside the application shell, beneath the top app bar

#### Scenario: Failure — the installation exposes no accessible repositories
- **GIVEN** a signed-in user whose installation and user access do not overlap
- **WHEN** they open the repository and discovery view
- **THEN** they see an empty-state explanation describing GitHub App installation and GitHub repository access
- **AND** the copy does not describe a missing board

#### Scenario: Edge case — an unsupported or permission-blocked repository
- **GIVEN** a listed repository whose discovery status is unsupported or permission-blocked
- **WHEN** the viewer looks at its row inside the shell
- **THEN** its status and reason are visible and no action that writes OpenSpec files or opens a pull request is offered
- **AND** no Idea, OpenSpec change, In progress, or PR/MR column appears on the repository and discovery view

### Requirement: Keep the interface preview surfaces unreachable unless explicitly enabled

The system SHALL treat interface preview surfaces as opt-in for the deployment. They SHALL be unreachable by default in every environment, including development. While disabled, every preview address SHALL respond as not found — not as a redirect to sign-in, not as an empty page, and not as a permission error that reveals the surface exists. While enabled, every preview page SHALL carry a persistent label identifying its content as fixture data. Fixture data used by a preview MUST NOT appear on any signed-in or signed-out production surface, whether or not previews are enabled.

#### Scenario: Happy path — previews are reachable once enabled
- **GIVEN** a deployment where interface previews have been explicitly enabled
- **WHEN** a viewer opens the preview index
- **THEN** the index renders
- **AND** it carries a persistent label identifying its content as fixture data

#### Scenario: Failure — previews are not enabled
- **GIVEN** a deployment where the preview opt-in is absent, empty, or set to any other value
- **WHEN** a viewer opens the preview index or any address beneath it, signed in or signed out
- **THEN** each responds as not found
- **AND** none of them redirects to sign-in or renders a partial page that would reveal the surface exists

#### Scenario: Edge case — enabling previews changes nothing in production surfaces
- **GIVEN** a deployment where interface previews have been enabled
- **WHEN** a signed-in user opens the signed-in surface and a visitor opens the signed-out view
- **THEN** neither shows preview fixture content, a preview label, or a link into the preview surfaces
- **AND** both render exactly as they do when previews are disabled
