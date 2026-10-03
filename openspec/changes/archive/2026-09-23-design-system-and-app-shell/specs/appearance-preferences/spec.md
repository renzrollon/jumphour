## Purpose

Lets a person choose how Jumphour looks in their browser — System, Light, or Dark, plus an optional decorative cats layer — and guarantees that the choice survives reloads, is applied before the first painted frame, follows the operating system when asked to, recovers from a corrupted stored value, and never changes what the product says or how it works.

## ADDED Requirements

### Requirement: Offer exactly three theme choices with Light as the default

The system SHALL offer the theme choices System, Light, and Dark, and no others. A viewer with no stored choice SHALL see the Light presentation, and the theme control SHALL show Light as the current choice rather than showing nothing chosen. The choice SHALL take effect immediately on the view the viewer is looking at.

#### Scenario: Happy path — a first-time viewer gets Light
- **GIVEN** a browser that has never stored a Jumphour appearance choice
- **WHEN** the viewer opens Jumphour
- **THEN** the page renders in the Light presentation
- **AND** the theme control shows Light as the current choice, with System and Dark offered beside it

#### Scenario: Failure — the browser refuses to store the choice
- **GIVEN** a browser that will not retain the appearance choice, such as a locked-down or private context
- **WHEN** the viewer selects Dark
- **THEN** the current view changes to the Dark presentation
- **AND** no error surface appears, and a later load falls back to the Light default rather than to a blank or half-themed page

#### Scenario: Edge case — choosing the option that is already chosen
- **GIVEN** a viewer whose current choice is Dark
- **WHEN** they select Dark again
- **THEN** the presentation stays Dark with no flash, reflow, or intermediate light frame
- **AND** the stored choice is still Dark

### Requirement: Persist the appearance choice per browser and apply it before first paint

The system SHALL store the theme choice and the cats choice per browser, SHALL apply both to every page of the application, and SHALL apply the resolved presentation to the first painted frame of a load so no viewer sees a frame in the wrong presentation. The choice SHALL belong to the browser rather than to a signed-in account, and SHALL survive reloads, navigation, and the end of a session.

#### Scenario: Happy path — a reload paints in the chosen presentation
- **GIVEN** a viewer who has chosen Dark
- **WHEN** they reload the page and then navigate to another page of the application
- **THEN** the first painted frame of each load is in the Dark presentation
- **AND** no Light frame is painted at any point during either load

#### Scenario: Failure — no stored choice is readable on load
- **GIVEN** a load in which no stored appearance choice can be read
- **WHEN** the page paints
- **THEN** the first painted frame is the Light default with the cats layer off
- **AND** there is no flash, no unstyled frame, and no message about the missing choice

#### Scenario: Edge case — a second browser tab and a later sign-out
- **GIVEN** a viewer with Jumphour open in one tab who chooses Dark
- **WHEN** they open a second tab and later sign out of Jumphour
- **THEN** the second tab loads in the Dark presentation
- **AND** signing out leaves the theme and cats choices intact, so the signed-out view is also Dark

### Requirement: Follow the operating system while the theme is System

The system SHALL, while the theme choice is System, present the Dark presentation when the operating system asks for dark and the Light presentation when it asks for light, and SHALL track a change to that operating-system setting while the page is open without requiring a reload. The stored choice SHALL remain System throughout; the operating system's current value MUST NOT be written back as the viewer's choice.

#### Scenario: Happy path — System matches the operating system
- **GIVEN** a viewer whose theme choice is System
- **WHEN** their operating system is set to dark and they load Jumphour
- **THEN** the page renders in the Dark presentation from the first painted frame
- **AND** the theme control shows System, not Dark, as the current choice

#### Scenario: Failure — the operating-system setting cannot be determined
- **GIVEN** a viewer whose theme choice is System on a platform that reports no light or dark preference
- **WHEN** they load Jumphour
- **THEN** the page renders in the Light presentation, which is the documented default
- **AND** the page is never rendered partly in one presentation and partly in the other

#### Scenario: Edge case — the operating system changes while the page is open
- **GIVEN** a viewer whose theme choice is System reading a page with an open overlay, a scrolled position, and typed but unsubmitted text
- **WHEN** they switch the operating system from light to dark
- **THEN** the presentation changes to Dark without a reload
- **AND** the overlay stays open, the scroll position and typed text are preserved, and the stored choice is still System

### Requirement: Keep the cats layer off by default and purely decorative

The system SHALL default the cats layer to off. When it is on, it MAY add restrained decorative accents in non-critical areas and MAY change the visible label of the Light and Dark theme options. It MUST NOT change the accessible name of any control, the set or order of controls, the information architecture, copy in any critical path, spacing or density, or any interaction. No information SHALL be available only when the cats layer is on.

#### Scenario: Happy path — cats is off until a viewer turns it on
- **GIVEN** a viewer who has never changed the cats choice
- **WHEN** they open Jumphour and then turn cats on
- **THEN** cats is off on arrival and its control says so
- **AND** turning it on changes only decorative accents and the visible labels of the Light and Dark theme options

#### Scenario: Failure — a decorative label would replace an accessible name
- **GIVEN** the cats layer is on and the Light and Dark theme options show their playful visible labels
- **WHEN** an assistive technology user reads the theme control
- **THEN** the options are still announced as the light theme and the dark theme
- **AND** the playful labels never become the announced names of those controls

#### Scenario: Edge case — the same screen with cats on and cats off
- **GIVEN** any screen captured once with cats off and once with cats on
- **WHEN** the two are compared
- **THEN** they contain the same controls in the same order, the same instructional and error copy, and the same spacing and density
- **AND** the only differences are decorative accents and the visible theme-option labels

### Requirement: Show one appearance choice through every control that presents it

The system SHALL treat the theme choice and the cats choice as one value each, however many controls present them. Every control that shows either choice SHALL show the same value at the same time, and a change made through any one of them SHALL be reflected by the others without a reload.

#### Scenario: Happy path — a change in one control shows in the other
- **GIVEN** a viewer with a theme control in the top app bar and the same choice offered in the settings surface
- **WHEN** they select Dark in the top app bar and then open the settings surface
- **THEN** the settings surface shows Dark as the current choice
- **AND** selecting System in the settings surface immediately updates the top app bar's control to System

#### Scenario: Failure — the stored value is not a valid choice
- **GIVEN** a stored appearance value that is not one of the offered choices
- **WHEN** the viewer opens Jumphour and inspects both the top app bar and the settings surface
- **THEN** both show the default choice, Light with cats off
- **AND** neither is left blank, showing nothing chosen, or disagreeing with the other

#### Scenario: Edge case — the cats toggle exists in two places
- **GIVEN** a cats toggle in the top app bar and a cats toggle in the settings surface
- **WHEN** the viewer turns cats on from the settings surface
- **THEN** the top app bar's toggle shows cats as on without a reload
- **AND** turning it off from the top app bar turns it off in the settings surface as well

### Requirement: Recover from an invalid stored appearance value

The system SHALL accept a stored theme value only when it is exactly `system`, `light`, or `dark`, and a stored cats value only when it is exactly `on` or `off`. Any other value — including a different capitalization, a value with surrounding whitespace, an empty value, or arbitrary text — SHALL be treated as absent and replaced by that choice's default. An invalid value for one choice MUST NOT affect the other. The next choice the viewer makes SHALL be stored as a valid value.

#### Scenario: Happy path — valid stored values are honored
- **GIVEN** a browser holding the theme value `dark` and the cats value `on`
- **WHEN** the viewer loads Jumphour
- **THEN** the page renders in the Dark presentation with the cats layer on
- **AND** both controls show those choices

#### Scenario: Failure — the stored value is arbitrary text
- **GIVEN** a browser holding the theme value `midnight` and the cats value `on`
- **WHEN** the viewer loads Jumphour
- **THEN** the theme falls back to Light
- **AND** the cats layer is still on, because one invalid value does not discard the other
- **AND** the invalid text is never shown to the viewer

#### Scenario: Edge case — near-miss spellings are not accepted
- **GIVEN** a browser holding the theme value `Dark`, or ` dark`, or `dark `
- **WHEN** the viewer loads Jumphour
- **THEN** each is treated as absent and the page renders in the Light default
- **AND** once the viewer selects Dark, the stored value becomes exactly `dark`, so the next load renders Dark
