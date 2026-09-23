## Context

The problem and the measured ratios are in proposal.md, under "Why". This section covers why the existing checks did not catch them.

`src/app/contrast.test.ts` measures a hand-kept table of token pairs, in three presentations: light, explicit dark, and system dark. Its coverage case scans every stylesheet for `var(--token)` references in `color`, `border*`, and `outline*` declarations, and fails when a token used there is missing from the table. That leaves two blind spots, and all three defects fall into them:

- **Literal colors are not tokens.** The danger button's `color: #ffffff` and the switch knob's `background: #ffffff` never reach the table, because the coverage scan only looks for `var(...)`.
- **Indicators painted with `background` are not scanned.** The knob and the chosen segmented option's fill are both `background` declarations, so nothing asks whether they clear 3:1.

`src/app/tokens.test.ts` pins the light block's token names to an exact `PROTOTYPE_TOKENS` list, so adding a token breaks it unless that list is dealt with.

`globals.css` already sets `box-sizing: border-box` everywhere and draws keyboard focus as a 2px `--accent` outline with a 2px offset (`:focus-visible`). No component overrides it.

## Goals / Non-Goals

**Goals:**

- Clear the three measured failures in all three presentations, with each fixing color expressed as a token that `contrast.test.ts` measures.
- Close both blind spots at their root, so a fourth defect of the same kind fails the suite:
  - literal colors are rejected outright;
  - every indicator painted with `background` is tied to its table entry by a rule pin.
- Change no component markup, props, exported type, or accessible name.

**Non-Goals:**

- Changing the value of any existing token. `--border2`, `--surface`, `--surface2`, `--accent`, `--accentInk`, and `--red` keep today's values.
- Extending the coverage scan to every `background` declaration. Every surface fill would then need an entry as a foreground, which is noise. The rule pins in Decision 4 cover the indicators that matter.
- Turning the modal scrim (`rgba(20, 19, 15, 0.45)`) into a token. No content sits on it, so it has no contrast pair. It is exempted by name.
- Amending the archived `design-system-and-app-shell` design.md. This change's design is the record.
- Fixing indicators that in-flight changes have not built yet, such as the selected-card ring in `workflow-board-ui`. The new requirement and the literal-color guard will cover them when they land.

## Decisions

### 1. The danger button gets its own ink and hover tokens

Two tokens are added to all three presentation blocks, following the existing `--accentInk` / `--accentHover` pair:

| Token | Light | Dark | Pair | Light ratio | Dark ratio |
|---|---|---|---|---|---|
| `--redInk` | `#ffffff` | `#14130f` | on `--red` (resting) | 6.54:1 | 7.67:1 |
| `--redHover` | `#9c2019` | `#f4a19b` | `--redInk` on it (hovered) | 7.97:1 | 9.22:1 |

The hover goes darker in light and lighter in dark, which is what `--accentHover` does. Each hover step is about 1.2:1 from `--red`, close to the accent pair's 1.23–1.26:1, so hover is as noticeable on both filled buttons.

`button.module.css`:

- `.danger` changes to `color: var(--redInk)`.
- `.danger:hover:not(:disabled)` changes to `background: var(--redHover)`.
- The `filter: brightness(0.92)` declaration is removed.

The filter had to go. It dims the whole element, label included, and the result is not a color the test can measure. The spec's hover scenario requires the label to stay above the floor and the hover to change only the fill.

**Rejected:**

- **Reusing `--accentInk` for the danger label.** It passes today (6.54 / 7.67), but it ties the destructive label to the accent. Retuning the accent would silently recolor the danger button, and the pair's name would no longer say what it measures.
- **Changing `--red`.** It also carries field-error text, the invalid-field border, the failed badge, the tone dot, and the banner rule. That would move five measured pairs to fix one.
- **Keeping the filter and computing its result in the test.** Browsers disagree about the color space `brightness()` works in, so the test would be asserting a guess.

### 2. The switch knob is painted from existing tokens: `--surface` when off, `--accentInk` when on

`switch.module.css`:

- `.knob` changes to `background: var(--surface)`.
- `.on .knob` gains `background: var(--accentInk)`.

The literal `#ffffff` is removed.

| Pair | Light | Dark |
|---|---|---|
| `--surface` on `--border2` (knob off, on the off track) | 3.49:1 | 3.30:1 |
| `--accentInk` on `--accent` (knob on, on the on track) | 7.90:1 | 7.92:1 |

In light both values are `#ffffff`, so light switches do not change at all. In dark the knob becomes graphite in both positions (`#1d1d1a` off, `#14130f` on). That matches the Material pattern of dark content on a pale "on" track, and the knob stays the same kind of object in both positions. The knob is the content sitting on the track, which is exactly what `--accentInk` is for, and when off it is a raised surface on a grey track.

**Rejected:**

- **Keeping the knob white when off and using `--accentInk` only when on.** In dark the knob would flip from white to near-black as the switch toggles, which reads as two different controls. It would also leave a literal color in place.
- **Adding a `--knob` token.** It would only alias `--surface` in both presentations and would not name anything new.
- **Darkening dark `--accent` until white clears 3:1.** `--accent` is also link and ghost-button text on dark surfaces (6.6–7.2:1 today), and it is the product's action color. Retuning it for one knob is backwards.

### 3. The chosen segmented option is outlined with the control border

`segmented-control.module.css`:

- `.option` changes from `border: 0` to `border: 1px solid transparent`.
- `.option[aria-checked="true"]` gains `border-color: var(--border2)`.

It keeps its `--surface` fill, `--ink` text, and `--shadow`. Because of `border-box`, every option stays 28px tall and at least 44px wide whether or not it is chosen. Moving the choice therefore resizes nothing, and the coarse-pointer `::after` hit areas stay as they are.

| Pair | Light | Dark |
|---|---|---|
| `--border2` on `--surface2` (outside the border: the group) | 3.04:1 | 3.04:1 |
| `--border2` on `--surface` (inside the border: the option's fill) | 3.49:1 | 3.30:1 |

The border is neutral and the focus ring is the accent. So a chosen option, a focused option, and one that is both chosen and focused all look different. Both indicators show on the last one, a grey border inside an offset indigo ring, which is what the spec's chosen-and-focused scenario requires.

Using a `border-color` rather than an inset `box-shadow` ring has an extra benefit: the existing coverage scan reads `border*`, so it sees the indicator too.

**Rejected:**

- **An `--accent` border** (6.6–7.9:1). The margin is generous, but a chosen option would look exactly like a focused one, since both would be indigo rings. That breaks the "distinguishable from focus" clause.
- **An `--accentSoft` fill.** It measures about 1.1:1 against the group, which is the same defect in a different color.
- **A heavier font weight on the chosen option.** Contrast cannot measure it. It also changes the label's width, so the option would resize as the choice moves, which the spec forbids.
- **Darkening `--surface2` until white clears 3:1 against it.** That needs roughly `#949494`, a mid-grey that would also become the menu-item hover and ghost-button hover fill.

**Margin.** 3.04:1 is close to the floor. That is deliberate and pinned: any later change to `--border2` or `--surface2` fails this pair by name, so nobody can retune those tokens without seeing what it costs this indicator.

### 4. `contrast.test.ts` adds pairs, rule pins, and a literal-color guard

**New pairs**, in all three presentations:

- A `"danger ink"` category at 4.5:1:
  - `--redInk` on `--red`
  - `--redInk` on `--redHover`
- A `"state indicators"` category at 3:1:
  - `--surface` on `--border2` (knob off)
  - `--accentInk` on `--accent` (knob on)
  - `--border2` on `--surface2` (chosen option border against the group)
  - `--border2` on `--surface` (chosen option border against its fill)

**Rule pins.** A table replaces the single hard-coded menu case. Each entry is a (stylesheet, selector, property, value) that the rule must declare. Each one ties a table pair to the rule that actually paints it. That matters most for `background` declarations, which the coverage scan does not read. The table holds:

- The existing menu-description pin, moved into the table unchanged.
- `button.module.css`:
  - `.danger`: `color: var(--redInk)` and `background: var(--red)`.
  - `.danger:hover:not(:disabled)`: `background: var(--redHover)`, with no `filter` declaration on that rule.
- `switch.module.css`:
  - `.track`: `background: var(--border2)`.
  - `.on`: `background: var(--accent)`.
  - `.knob`: `background: var(--surface)`.
  - `.on .knob`: `background: var(--accentInk)`.
- `segmented-control.module.css`:
  - `.group`: `background: var(--surface2)`.
  - `.option`: `border: 1px solid transparent`.
  - `.option[aria-checked="true"]`: `border-color: var(--border2)` and `background: var(--surface)`.

A missing or changed pin fails with the file, the selector, and the expected declaration.

**The literal-color guard** is a pure function that takes a file's path and CSS text and returns failure sentences. It runs over every `.css` file under `src/` except `tokens.css`.

- **Which declarations it checks:** those that can paint a color:
  - `color`, `background`, `background-color`, `background-image`, `box-shadow`, `fill`, `stroke`, `caret-color`, `accent-color`;
  - every `border*` and `outline*` property, except the ones that only set geometry or style (`border-radius`, `border-width`, `border-style`, `border-collapse`, `border-spacing`, `outline-offset`, `outline-width`, `outline-style`);
  - `text-decoration*` and `column-rule*`.
- **What passes:** the guard removes every `var(--…)` reference, numbers with or without units, commas, and slashes. Whatever is left must be one of these keywords: `transparent`, `currentColor`, `inherit`, `initial`, `unset`, `none`, `solid`, `dashed`, `dotted`, `double`, `inset`, `underline`, compared case-insensitively because CSS keywords are.
- **Fail-closed:** anything else fails, whether it is a hex value, a color function, a named color, or an identifier the guard does not recognise. A new keyword is added to the list on purpose, never waved through.
- **Exemptions**, named in a table with a reason for each, like `EXEMPT`:
  - the modal backdrop rule in `modal.module.css` (the scrim carries no content);
  - any declaration nested under `@media (forced-colors: active)`, where system colors such as `CanvasText` are the correct choice.
- **Failure message:** it reads `<repo path> <selector> { <property>: <value> } paints a color outside the token set`.

**Negative cases** prove the checks can fail:

- **Danger ink:** extend the existing "names the failing pair" case. Setting dark `--redInk` to `#ffffff`, which recreates today's defect, yields exactly two danger-ink sentences: resting at 2.42:1 and hovered at 2.01:1.
- **Chosen option:** setting dark `--border2` to `#2f2f2a` (the `--border` value) turns the chosen option into a fill-only difference. The failure list then includes the sentence `dark: --border2 on --surface2 (state indicators, chosen segmented option border against the group) = 1.15:1, needs 3:1`. The test asserts that this sentence is present rather than matching the whole list, because the same value also fails the other `--border2` pairs.
- **Literal colors:** feed the guard an in-memory stylesheet containing `.x { color: #ffffff }`, `.y { background: white }`, and `.z { border: 1px solid rgb(0 0 0) }`. It returns exactly three sentences, one per rule. The same stylesheet with each value replaced by `var(--ink)` returns none.

### 5. `tokens.test.ts` separates prototype tokens from Jumphour's additions

`PROTOTYPE_TOKENS` stays exactly as it is. A second list, `JUMPHOUR_TOKENS = ["--redInk", "--redHover"]`, carries a comment pointing at this design. The light-block case asserts the names equal the union of the two lists. A new case asserts the lists are disjoint, so an addition can never quietly redefine a prototype name. The existing "same token-name set in all three blocks" case already forces both dark blocks to define the additions. The header comment in `tokens.css` is updated to list the two additions next to the two darkened values.

**Rejected:** appending the new names to `PROTOTYPE_TOKENS`. The test would then state something false, since the prototype has neither token, and a later reader could not tell a ported token from an invented one.

### Invariant sweep: every painted color resolves through a measured token

The invariant is not a new value. It is the rule that every color a stylesheet paints is a token the contrast table can measure.

| Reader | Today | After | Enforced by |
|---|---|---|---|
| Danger button label | literal `#ffffff` | `--redInk` | pin + danger-ink pair + guard |
| Danger button hover | `filter` on the whole element | `--redHover` fill | pin (no `filter`) + pair |
| Switch knob off | literal `#ffffff` | `--surface` | pin + state-indicator pair + guard |
| Switch knob on | literal `#ffffff` | `--accentInk` | pin + state-indicator pair + guard |
| Chosen segmented option | `--surface` fill only (1.15 / 1.09) | + `--border2` border | pin + two state-indicator pairs + coverage scan |
| Modal scrim | `rgba(20, 19, 15, 0.45)` | unchanged | named exemption |
| Source badge under forced colors | `CanvasText` | unchanged | forced-colors exemption |
| Every other component stylesheet | all `var(--…)` or keywords | unchanged | guard (passes today) |

The existing tokens `--surface`, `--accentInk`, and `--border2` each gain one reader. None of them changes value, so no existing pair moves.

## Risks / Trade-offs

- **[The dark switch knob looks different from the prototype's white knob]** → This is intentional and limited to dark. A white knob on the dark `--accent` measures 2.35:1. Light is pixel-identical.
- **[The chosen-option border clears 3:1 by only 0.04]** → It is pinned in both presentations. Any retune of `--border2` or `--surface2` fails the named pair before it ships.
- **[The guard's keyword list rejects a legitimate new value, such as `wavy`]** → That is the fail-closed choice. The fix is a one-word addition to the list, reviewed in the diff. The alternative is a list of CSS's 148 named colors, which fails open for anything it forgets.
- **[The rule pins couple the test to selector strings]** → The pins exist to tie table entries to real rules, so a renamed selector should fail. The existing menu pin already works this way.
- **[The `--border2` border makes the chosen option slightly heavier in the top bar]** → The spec asks for exactly this. The border is 1px, neutral, and inside the option's existing box, so it does not change the layout.

## Migration Plan

The change is pure CSS and tests, with no data, route, or dependency change. It touches no file owned by `workflow-board-ui`, `card-detail-and-source-health-ui`, `handoff-flow-dialogs-ui`, or `mcp-inboxes-and-idea-snapshots`, so it can be applied before, between, or after them. Applying it before `mcp-inboxes-and-idea-snapshots` means that change's "Remove idea" confirmation gets a legible destructive button from the start. To roll back, revert the commit.

## Open Questions

- Should the modal scrim become a `--scrim` token, so that the guard needs only the forced-colors exemption? This can be decided later: it changes no pair, no spec, and no task here.
