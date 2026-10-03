## MODIFIED Requirements

### Requirement: Present a light and a dark surface system that both meet WCAG AA

The system SHALL define one named set of page, surface, layered-surface, border, ink, accent, and semantic tone values, and SHALL provide a complete value for every name in both a light and a dark presentation. Light is a warm off-white page with elevated near-white surfaces, deep ink text, and one confident indigo action color; dark is a near-black canvas with layered graphite surfaces, pale ink, and a muted accessible accent. Body and metadata text, and the label text of a filled control in both its resting and its hovered state, SHALL meet at least 4.5:1 contrast against the surface or fill it sits on, and large text, control borders, focus indicators, and tone dots SHALL meet at least 3:1, in both presentations. Every color a surface paints SHALL be drawn from the named set, so that every pairing can be measured against these floors; the only exceptions are the dimming layer behind a modal overlay, which carries no content of its own, and the system colors a forced-colors presentation supplies. The dark presentation MUST NOT be a mechanical inversion of the light one: elevation ordering, accent legibility, and border separation MUST each hold on their own terms.

#### Scenario: Happy path — both presentations clear the contrast floor
- **GIVEN** the light presentation and the dark presentation of the same screen
- **WHEN** body text, metadata text, accent text, and each semantic tone are measured against the surface each is rendered on
- **THEN** every text pairing measures at least 4.5:1 in both presentations
- **AND** every control border, focus indicator, and tone dot measures at least 3:1 in both presentations

#### Scenario: Happy path — a destructive action is legible in both presentations
- **GIVEN** a destructive action control, whose fill is the danger tone, shown in the light presentation and in the dark presentation
- **WHEN** its label is measured against its fill
- **THEN** the label measures at least 4.5:1 in both presentations
- **AND** in the dark presentation, where the danger fill is a light red, the label is dark ink rather than white

#### Scenario: Failure — a surface value is missing for one presentation
- **GIVEN** a surface that asks for a named value the active presentation does not define
- **WHEN** it renders
- **THEN** it falls back to the defined base surface and base ink pairing, which still meets the contrast floor
- **AND** it never falls through to the browser's own default colors, which would leave text or a border below that floor

#### Scenario: Failure — a component paints a color outside the named set
- **GIVEN** a component whose styling paints its text, fill, border, or outline with a literal color that is not one of the named values
- **WHEN** the interface's contrast is verified
- **THEN** verification fails and names the stylesheet, the rule, the property, and the literal color
- **AND** the color is not silently left unmeasured because it bypassed the named set

#### Scenario: Edge case — a filled control is hovered
- **GIVEN** a primary action control and a destructive action control, in each presentation
- **WHEN** a pointer hovers each one
- **THEN** each hovered fill is a single solid named value, and the label measures at least 4.5:1 against it
- **AND** the hover changes only the fill, never dimming the label below the floor it met at rest

#### Scenario: Edge case — three stacked elevations stay distinguishable in dark
- **GIVEN** the dark presentation showing a page background, a panel on it, and a raised overlay on the panel
- **WHEN** a viewer reads the three layers
- **THEN** each layer is distinguishable from the one beneath it by its own surface value and its border
- **AND** no layer relies on a glow, a saturated fill, or a shadow alone to separate itself

## ADDED Requirements

### Requirement: Mark a control's chosen or on state with an indicator that clears 3:1

The system SHALL mark the chosen option of a mutually exclusive option group, and the on or off position of a toggle, with a visual indicator that measures at least 3:1 against each color adjacent to it, in both presentations. A change of surface fill, text weight, or shadow MUST NOT be the only visual difference between a chosen option and its unchosen neighbours when that fill measures below 3:1 against them. The chosen-state indicator SHALL remain distinguishable from the keyboard focus indicator, and showing it SHALL NOT change the control's size or move the controls beside it.

#### Scenario: Happy path — the chosen theme option is identifiable in both presentations
- **GIVEN** the three-option theme control with Dark chosen, in the light presentation and in the dark presentation
- **WHEN** a viewer compares the chosen option with its two neighbours
- **THEN** the chosen option carries an outline measuring at least 3:1 against the group background around it and at least 3:1 against its own fill
- **AND** the two unchosen options carry no such outline

#### Scenario: Happy path — a toggle's knob stays visible on its track in dark
- **GIVEN** the dark presentation, in which the toggle's on-track is the pale accent and its off-track is a mid-grey
- **WHEN** the toggle is shown on and then off
- **THEN** the knob measures at least 3:1 against the on-track and at least 3:1 against the off-track
- **AND** the toggle still exposes its on or off state to assistive technology exactly as before

#### Scenario: Failure — a chosen state carried by a sub-floor fill alone
- **GIVEN** an option group whose chosen option differs from its neighbours only by a surface fill measuring below 3:1 against the group
- **WHEN** the interface's contrast is verified
- **THEN** verification fails and names the control, the presentation, the pair of colors, and the measured ratio
- **AND** the control is not reported as meeting the floor because its shadow or text color also changed

#### Scenario: Edge case — the chosen option is also the focused option
- **GIVEN** a keyboard user who has tabbed into the theme control, so the chosen option also holds focus
- **WHEN** they press an arrow key and the choice moves to the neighbouring option
- **THEN** the chosen-state outline moves with the choice and the focus indicator moves with focus, and the two remain visually distinct from each other
- **AND** no option changes width or height, and no neighbouring control moves, as the chosen state moves between options
