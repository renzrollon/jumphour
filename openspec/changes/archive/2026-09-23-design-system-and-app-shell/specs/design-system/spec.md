## Purpose

Defines the visual and interaction contract every Jumphour surface obeys — light and dark surface systems at WCAG AA, one type scale with a monospace companion for machine identifiers, state that is never carried by color alone, visible keyboard focus, honored reduced motion, comfortable touch targets, and one shared behavior for overlays, menus, and radiogroup-style controls.

## ADDED Requirements

### Requirement: Present a light and a dark surface system that both meet WCAG AA

The system SHALL define one named set of page, surface, layered-surface, border, ink, accent, and semantic tone values, and SHALL provide a complete value for every name in both a light and a dark presentation. Light is a warm off-white page with elevated near-white surfaces, deep ink text, and one confident indigo action color; dark is a near-black canvas with layered graphite surfaces, pale ink, and a muted accessible accent. Body and metadata text SHALL meet at least 4.5:1 contrast against the surface it sits on, and large text, control borders, focus indicators, and tone dots SHALL meet at least 3:1, in both presentations. The dark presentation MUST NOT be a mechanical inversion of the light one: elevation ordering, accent legibility, and border separation MUST each hold on their own terms.

#### Scenario: Happy path — both presentations clear the contrast floor
- **GIVEN** the light presentation and the dark presentation of the same screen
- **WHEN** body text, metadata text, accent text, and each semantic tone are measured against the surface each is rendered on
- **THEN** every text pairing measures at least 4.5:1 in both presentations
- **AND** every control border, focus indicator, and tone dot measures at least 3:1 in both presentations

#### Scenario: Failure — a surface value is missing for one presentation
- **GIVEN** a surface that asks for a named value the active presentation does not define
- **WHEN** it renders
- **THEN** it falls back to the defined base surface and base ink pairing, which still meets the contrast floor
- **AND** it never falls through to the browser's own default colors, which would leave text or a border below that floor

#### Scenario: Edge case — three stacked elevations stay distinguishable in dark
- **GIVEN** the dark presentation showing a page background, a panel on it, and a raised overlay on the panel
- **WHEN** a viewer reads the three layers
- **THEN** each layer is distinguishable from the one beneath it by its own surface value and its border
- **AND** no layer relies on a glow, a saturated fill, or a shadow alone to separate itself

### Requirement: Type the interface with one scale and a monospace companion

The system SHALL render prose, labels, headings, and helper copy in one legible sans-serif face, and SHALL render machine identifiers — repository slugs, issue and ticket keys, OpenSpec change names, branch names, file and artifact paths, and pull-request or merge-request numbers — in a monospace companion face. The scale SHALL distinguish page titles, section titles, item titles, metadata, and helper text, and metadata SHALL remain comfortably readable rather than miniature. Copy SHALL be sentence case. Both faces SHALL declare a fallback stack so text is legible and correctly proportioned before the preferred faces are available.

#### Scenario: Happy path — identifiers read as machine text
- **GIVEN** a surface showing the repository `acme/api-gateway`, the change name `add-idempotency-keys`, and the path `openspec/changes/add-idempotency-keys/proposal.md` inside a sentence of helper copy
- **WHEN** the surface renders
- **THEN** all three identifiers render in the monospace companion face
- **AND** the surrounding helper copy renders in the sans-serif face at the metadata size of the scale

#### Scenario: Failure — the preferred faces are unavailable
- **GIVEN** a viewer whose browser cannot load the preferred faces
- **WHEN** any surface renders
- **THEN** prose renders in the declared sans-serif fallback and identifiers render in the declared monospace fallback
- **AND** no text renders invisibly or collapses the layout while fonts are resolving

#### Scenario: Edge case — mixed identifier shapes in one row
- **GIVEN** a row containing the issue key `#814`, the ticket key `PAY-184`, and the review reference `PR #482`
- **WHEN** the row renders
- **THEN** each of the three keys renders in the monospace companion face
- **AND** the words around them, including a source label such as `Jira · MCP`, remain in the sans-serif face so the identifier is the part that reads as machine text

### Requirement: Never convey state by color alone

The system SHALL accompany every state, status, tone, or severity signal with text that states the same thing. A colored dot, a tinted background, a source accent, a hover effect, motion, or a decorative theme MUST NOT be the only carrier of a meaning a user needs.

#### Scenario: Happy path — a tone signal is paired with its words
- **GIVEN** a surface showing a delayed state, a healthy state, and a failed state
- **WHEN** each is rendered
- **THEN** each shows a text label naming the state alongside its tone indicator
- **AND** the text is sufficient to tell the three apart without seeing the indicator

#### Scenario: Failure — the rendering carries no color at all
- **GIVEN** the same surface rendered without color, as in a monochrome or forced-colors presentation
- **WHEN** a viewer reads it
- **THEN** every state present is still identifiable from its text
- **AND** no signal disappears, and no two different states become indistinguishable

#### Scenario: Edge case — two different states share one tone
- **GIVEN** two distinct states that both use the warning tone, such as a stale snapshot and a delayed listener
- **WHEN** both are shown on the same screen
- **THEN** their text labels differ and each names its own condition
- **AND** a viewer can act on the correct one without relying on the shared tone

### Requirement: Label every source badge with text

The system SHALL render a source badge with a visible text label: `GitHub` for GitHub, `GitLab` for GitLab, `Jira · MCP` for Jira reached through MCP, and `Manual` for an idea composed in Jumphour. A badge's accent color or mark MUST NOT be its only identification, and a source accent MUST be confined to the badge rather than tinting the surface it sits on.

#### Scenario: Happy path — all four sources name themselves
- **GIVEN** a surface showing one item from each of the four sources
- **WHEN** the badges render
- **THEN** the four badges read `GitHub`, `GitLab`, `Jira · MCP`, and `Manual`
- **AND** each badge's accent is contained within the badge, leaving the surrounding card or row on its neutral surface

#### Scenario: Failure — the badge accent cannot be applied
- **GIVEN** a presentation in which the badge's accent color is unavailable, such as a monochrome or forced-colors rendering
- **WHEN** the badge renders
- **THEN** the source is still named in text
- **AND** the item's meaning and readability are unchanged

#### Scenario: Edge case — Jira is shown as a source, not as a brand
- **GIVEN** an item captured from Jira through MCP
- **WHEN** its badge renders
- **THEN** the badge reads `Jira · MCP` in a restrained badge treatment
- **AND** the Jira accent is not used as the surface's primary action color anywhere on the screen

### Requirement: Show a visible keyboard focus indicator on every interactive control

The system SHALL render a clearly visible focus indicator on any control that receives keyboard focus, meeting at least 3:1 contrast against its adjacent colors and offset so that it is not clipped by the control's own edge. Tab order SHALL follow reading order. The indicator SHALL be shown for keyboard focus and SHALL NOT be painted for a plain pointer press on a control that does not otherwise need it.

#### Scenario: Happy path — tabbing through the interface is traceable
- **GIVEN** a signed-in screen
- **WHEN** a keyboard user presses Tab repeatedly
- **THEN** each focused control shows the focus indicator at its position in reading order
- **AND** no focus step lands on a control with no visible indicator

#### Scenario: Failure — the focused control shares the indicator's color
- **GIVEN** a primary action control filled with the accent color
- **WHEN** it receives keyboard focus
- **THEN** its focus indicator remains distinguishable from both the control's fill and the surface behind it at 3:1 or better
- **AND** the indicator is not hidden behind the control's own edge or a neighbouring control

#### Scenario: Edge case — focus moves to a control outside the visible area
- **GIVEN** a scrollable region whose next focusable control is scrolled out of view
- **WHEN** keyboard focus moves to that control
- **THEN** the region scrolls so the focused control and its indicator are visible
- **AND** focus is not lost to the page body

### Requirement: Give every icon-only control an accessible name

The system SHALL expose an accessible name that states the control's purpose on every control whose visible content is only an icon, an initial, or a glyph. Purely decorative imagery — the product mark, tone dots, illustration art, and decorative theme accents — SHALL be hidden from assistive technology rather than announced. A control's accessible name MUST NOT be replaced by a decorative label.

#### Scenario: Happy path — icon-only controls announce their purpose
- **GIVEN** a top app bar containing icon-only controls for theme, settings, and the account
- **WHEN** an assistive technology user moves through them
- **THEN** each is announced with a name that states what it does
- **AND** no control is announced only as an unnamed button or image

#### Scenario: Failure — decoration would otherwise be announced
- **GIVEN** a screen containing the product mark, a tone dot, and an empty-state illustration
- **WHEN** an assistive technology user reads the screen
- **THEN** none of the three is announced as content or as a control
- **AND** the information each decorates is still available from adjacent text

#### Scenario: Edge case — a control's visible label is decorative
- **GIVEN** a control whose visible label changes for decorative reasons while its function does not
- **WHEN** the decorative label is in effect
- **THEN** the control's accessible name still states its function
- **AND** the accessible name is identical to what it was before the decorative label applied

### Requirement: Honor the viewer's reduced-motion setting

The system SHALL suppress animation and transition when the viewer's operating system or browser requests reduced motion. Animation SHALL be limited to short, functional transitions — an overlay opening, a loading placeholder, an in-progress indicator — and the system MUST NOT use decorative looping animation anywhere, whether or not motion is reduced.

#### Scenario: Happy path — motion is suppressed on request
- **GIVEN** a viewer whose system requests reduced motion
- **WHEN** an overlay opens, a loading placeholder shows, and an in-progress indicator runs
- **THEN** none of the three animates
- **AND** each still appears, still communicates its state, and still dismisses normally

#### Scenario: Failure — a state would otherwise be communicated only by motion
- **GIVEN** a loading placeholder whose usual shimmer is suppressed
- **WHEN** it renders under reduced motion
- **THEN** it still reads as content that is loading, through its static placeholder shape and accompanying text
- **AND** the viewer is not left with a surface that looks empty or finished

#### Scenario: Edge case — motion is allowed
- **GIVEN** a viewer who has not requested reduced motion
- **WHEN** they use the interface for an extended period without interacting
- **THEN** no element animates on a loop for decoration
- **AND** the only motion present is a transition tied to an action the viewer took or to work actually in progress

### Requirement: Keep touch targets comfortable on coarse pointers

The system SHALL give every interactive control an activation area of at least 44 by 44 CSS pixels when the viewer's primary pointer is coarse, without changing the control's visual size or the interface's density for fine pointers. Adjacent controls SHALL keep enough separation that an intended target is not missed.

#### Scenario: Happy path — compact controls grow their hit area on touch
- **GIVEN** a viewer on a coarse-pointer device
- **WHEN** they use a compact control such as a toggle, a filter, or an icon-only button
- **THEN** the control's activation area is at least 44 by 44 CSS pixels
- **AND** the same control on a fine-pointer device keeps its compact visual size and the surrounding layout is unchanged

#### Scenario: Failure — a control's drawn box is smaller than the floor
- **GIVEN** a control drawn at roughly 26 to 32 pixels, such as a switch track or a segmented option
- **WHEN** it is rendered for a coarse pointer
- **THEN** its activation area is expanded to the floor around the drawn box
- **AND** the drawn box itself does not grow, so the interface's density and alignment are preserved

#### Scenario: Edge case — controls sit directly beside one another
- **GIVEN** a group of adjacent controls such as a three-option segmented control
- **WHEN** their activation areas are expanded for a coarse pointer
- **THEN** the areas do not overlap
- **AND** a touch aimed at one option does not activate its neighbour

### Requirement: Trap, dismiss, and restore focus for modal overlays

The system SHALL, for every modal overlay — a centered dialog or a side sheet — move keyboard focus into the overlay when it opens, keep forward and backward tabbing within it, make the content behind it unreachable to pointer and assistive technology while it is open, close it when Escape is pressed and closing is safe, and return focus to the control that invoked it when it closes. When an operation started from the overlay is in flight and closing would abandon or obscure it, Escape MUST NOT close the overlay and the overlay MUST state that it is working.

#### Scenario: Happy path — open, trap, escape, restore
- **GIVEN** a control that opens a modal overlay
- **WHEN** the viewer activates it, tabs forward past the last control, tabs backward past the first, and then presses Escape
- **THEN** focus enters the overlay on open, wraps within the overlay in both directions, and the overlay closes on Escape
- **AND** focus returns to the control that opened it

#### Scenario: Failure — closing while work is in flight
- **GIVEN** a modal overlay with an operation in progress that it started
- **WHEN** the viewer presses Escape
- **THEN** the overlay does not close
- **AND** it continues to state that the operation is running rather than silently ignoring the key

#### Scenario: Edge case — the invoking control is gone when the overlay closes
- **GIVEN** a modal overlay whose invoking control is no longer present when the overlay closes
- **WHEN** the overlay closes
- **THEN** focus moves to the nearest surviving region that contained the invoking control
- **AND** focus is not dropped to the top of the document, so the viewer's keyboard position is preserved

### Requirement: Dismiss and navigate menus and popovers from the keyboard

The system SHALL, for every transient non-modal surface — a menu or a popover — mark the invoking control as expanded while it is open, dismiss it when Escape is pressed or when a pointer interaction occurs outside it, return focus to the invoking control when Escape dismisses it, and move focus between its items with the Up and Down arrow keys, wrapping at both ends, with Home and End moving to the first and last item.

#### Scenario: Happy path — arrow through a menu and choose an item
- **GIVEN** an open menu whose invoking control is marked expanded
- **WHEN** the viewer presses Down twice, End, Home, and then Enter
- **THEN** focus moves between items on each arrow key, to the last item on End, and to the first on Home
- **AND** Enter activates the focused item and closes the menu

#### Scenario: Failure — the viewer clicks away without choosing
- **GIVEN** an open menu or popover
- **WHEN** the viewer clicks outside it
- **THEN** it dismisses without activating any item
- **AND** nothing the menu could have changed is changed

#### Scenario: Edge case — a transient surface opens while another is open
- **GIVEN** an open menu and a second control that opens a popover
- **WHEN** the viewer opens the popover
- **THEN** the first surface dismisses so only one transient surface is open
- **AND** if a transient surface is open inside a modal overlay, Escape dismisses only that transient surface and leaves the overlay open

### Requirement: Operate radiogroup-style controls with arrow keys

The system SHALL present a mutually exclusive option group as a single tab stop with exactly one option marked as chosen, move the choice between options with the Left, Right, Up, and Down arrow keys, wrap from the last option to the first and back, and announce which option is chosen. Tab SHALL leave the group rather than move within it.

#### Scenario: Happy path — arrow keys move the choice
- **GIVEN** a three-option group with the second option chosen
- **WHEN** the viewer tabs to the group and presses the Right arrow
- **THEN** focus enters on the chosen option and the third option becomes the chosen one
- **AND** the group remains one stop in the tab order

#### Scenario: Failure — no option is currently chosen
- **GIVEN** an option group whose current value is not one of its options
- **WHEN** the viewer tabs to the group
- **THEN** the group is still reachable and focus lands on its first option
- **AND** pressing an arrow key or activating an option establishes a valid choice

#### Scenario: Edge case — wrapping and leaving the group
- **GIVEN** a three-option group with the last option chosen
- **WHEN** the viewer presses the Right arrow and then Tab
- **THEN** the choice wraps to the first option
- **AND** Tab moves to the next control after the group rather than to another option inside it
