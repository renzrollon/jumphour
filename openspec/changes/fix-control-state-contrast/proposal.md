## Why

The design-system change closed every token pair below the WCAG AA floor, but three places still fail in the shipped primitives. The contrast test missed all three: two are hardcoded colors rather than tokens, and the third is a selected state that differs only by its surface fill.

| Where | Presentation | Measured | Floor |
|---|---|---|---|
| Danger `Button`: `#ffffff` text on `--red` | dark | 2.42:1 | 4.5:1 |
| `Switch` knob when on: `#ffffff` on the `--accent` track | dark | 2.35:1 | 3:1 |
| Chosen `SegmentedControl` option: `--surface` against the `--surface2` group | light / dark | 1.15:1 / 1.09:1 | 3:1 |

Each of these has to be fixed now. The theme control, a segmented control, is in the top app bar of every signed-in screen. The cats switch is in settings. The danger button currently appears only in the `/dev/ui` preview, but the intake change's "Remove idea" confirmation is the first production dialog that will need a destructive action.

## What Changes

- The danger button's label is painted with a new `--redInk` token (light `#ffffff`, dark `#14130f`), and its hover fill with a new `--redHover` token (light `#9c2019`, dark `#f4a19b`). These replace the hardcoded `#ffffff` text and the `filter: brightness(0.92)` hover. The filter darkened the label as well as the fill, so the test had no color it could measure. The new tokens follow the existing `--accentInk` / `--accentHover` pair.
- The switch knob is painted from tokens: `--surface` when off and `--accentInk` when on, instead of a hardcoded `#ffffff`. In light the knob stays white. In dark it becomes graphite, which clears 3:1 against both tracks.
- The chosen segmented option gets a 1px `--border2` border. Every option carries a transparent 1px border, so the chosen one keeps the same size. The border clears 3:1 against the group fill on its outside and the option fill on its inside, in both presentations. It is neutral, so a chosen option still looks different from a focused one, which uses the accent outline.
- `contrast.test.ts` measures each new pair and checks that each component stylesheet rule really uses the token its pair names. It also gains a guard: no component stylesheet may paint a color outside the token set. Two exemptions are named: the modal scrim, which has no content on it, and forced-colors system colors. With the guard in place, a hardcoded color fails the suite instead of escaping measurement.
- `tokens.test.ts` keeps the prototype token list as it is and gets a separate, explicit list of tokens Jumphour adds beyond the prototype, so "prototype names, verbatim" stays true.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `design-system`:
  - The requirement "Present a light and a dark surface system that both meet WCAG AA" now also covers label text on a filled control in both its resting and hovered states. It also requires every painted color to come from the named value set, apart from the two exemptions.
  - A new requirement says the indicator marking a control's chosen or on state must clear 3:1 against the colors next to it.

## Impact

- **Code:** `src/app/tokens.css` (two new tokens in all three presentation blocks), `src/app/components/ui/button.module.css`, `switch.module.css`, `segmented-control.module.css`. No component markup, props, or exported types change.
- **Tests:** `src/app/contrast.test.ts` (new pairs, rule pins, literal-color guard) and `src/app/tokens.test.ts` (the list of tokens added beyond the prototype). The existing `switch`, `segmented-control`, `button`, `not-color-alone`, and `cats-invariance` suites pass without edits.
- **Visible change:**
  - The danger button in dark gets dark label text, and its hover is a solid lighter red.
  - The switch knob in dark is graphite.
  - The chosen theme option in the top bar and settings gets a thin neutral border.
  - Light-presentation switches look exactly as they do today.
- **Dependencies:** none added.
- **Later changes:**
  - `workflow-board-ui`'s selected-card ring and any later colored state indicator fall under the new 3:1 state-indicator requirement.
  - The literal-color guard rejects any stylesheet that paints a color outside the token set.
  - This change touches no file owned by the four in-flight UI changes, so it can be applied before or between them.
