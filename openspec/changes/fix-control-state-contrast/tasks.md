## 1. Repro: checks that fail on today's stylesheets

Owns `src/app/contrast.test.ts` and `src/app/tokens.test.ts`. Lands first. Each task states exactly which cases are red against today's `tokens.css` and component stylesheets, and why, so group 2 has a pass/fail signal. Change no stylesheet in this group.

- [x] 1.1 Add the design.md Decision 4 pairs to `FLOORS`: a `"danger ink"` category at 4.5 with `--redInk` on `--red` ("danger button") and `--redInk` on `--redHover` ("hovered danger button"), and a `"state indicators"` category at 3 with `--surface` on `--border2` ("switch knob when off"), `--accentInk` on `--accent` ("switch knob when on"), `--border2` on `--surface2` ("chosen segmented option border against the group") and `--border2` on `--surface` ("chosen segmented option border against its fill"), and verify against today's `tokens.css` that the four state-indicator pairs pass in all three presentations while the two danger-ink pairs fail in each as "not a pair of solid colors", because neither token exists yet
- [x] 1.2 Replace the single menu-description case with a rule-pin table of (stylesheet, selector, declaration) entries plus "must not declare" entries, holding every pin listed in design.md Decision 4, a pin that `.danger:hover:not(:disabled)` declares no `filter`, and a pin that `.option[aria-checked="true"]` declares none of `border`, `border-width`, `padding`, `font-weight`, `min-width`, or `height` (so choosing an option cannot resize it), and verify each failure names the file, the selector, and the expected or forbidden declaration; that the existing menu pin still passes; and that on today's stylesheets exactly these pins fail: `.danger` color, `.danger:hover:not(:disabled)` background, `.danger:hover:not(:disabled)` no-`filter`, `.knob` background, `.on .knob` background, `.option` border, and `.option[aria-checked="true"]` border-color
- [x] 1.3 Add the literal-color guard as a pure function of (file path, CSS text) with the property set, the fail-closed keyword allowlist, and the two named exemptions from design.md Decision 4, and run it over every `.css` file under `src/` except `tokens.css`, and verify:
  - an in-memory stylesheet with `.x { color: #ffffff }`, `.y { background: white }` and `.z { border: 1px solid rgb(0 0 0) }` returns exactly three sentences, each naming the selector, property, and value;
  - the same stylesheet with each value replaced by `var(--ink)` returns none;
  - `text-decoration: wavy underline` fails on `wavy`;
  - `@media (forced-colors: active) { .b { border-color: CanvasText } }` returns none;
  - the scan over today's `src/` fails with exactly two sentences, one for `button.module.css .danger { color: #ffffff }` and one for `switch.module.css .knob { background: #ffffff }`, with the modal backdrop and the source badge's forced-colors rule not reported
- [x] 1.4 Add two negative contrast cases, and verify:
  - setting dark `--border2` to `#2f2f2a` produces a failure list that includes `dark: --border2 on --surface2 (state indicators, chosen segmented option border against the group) = 1.15:1, needs 3:1`. This passes on today's tokens.
  - setting dark `--redInk` to `#ffffff` produces exactly the two danger-ink sentences, resting at 2.42:1 and hovered at 2.01:1. This stays red until task 2.1 defines `--redHover`.
- [x] 1.5 In `tokens.test.ts`, keep `PROTOTYPE_TOKENS` unchanged, add `JUMPHOUR_TOKENS = ["--redInk", "--redHover"]` with a comment citing this change's design.md Decision 5, assert that the light block's names equal the union of the two lists, and add a case asserting the two lists are disjoint, and verify on today's `tokens.css` that the union case fails listing `--redInk` and `--redHover` as missing while the disjoint case passes

## 2. Fix: two tokens and three primitive stylesheets

Owns `src/app/tokens.css`, `src/app/components/ui/button.module.css`, `switch.module.css`, and `segmented-control.module.css`. Depends on group 1. The tasks touch disjoint files. Change no component `.tsx` file and no existing token value.

- [x] 2.1 Add `--redInk` (light `#ffffff`, dark `#14130f`) and `--redHover` (light `#9c2019`, dark `#f4a19b`) to the light block and both dark blocks of `tokens.css`, and update the header comment to name the two additions beside the two darkened values, and verify the danger-ink pairs pass in all three presentations at 6.54 / 7.67 / 7.67 (resting) and 7.97 / 9.22 / 9.22 (hovered), that 1.4's `--redInk` case and 1.5's union case now pass, and that the existing "same token-name set in every block" case still passes
- [x] 2.2 In `button.module.css`, set `.danger` to `color: var(--redInk)` and `.danger:hover:not(:disabled)` to `background: var(--redHover)`, removing `filter: brightness(0.92)`, and verify all four danger pins pass, the guard no longer reports `button.module.css`, and `button.test.tsx` passes unedited
- [x] 2.3 In `switch.module.css`, set `.knob` to `background: var(--surface)` and add `background: var(--accentInk)` to `.on .knob`, and verify the four switch pins pass, the guard reports nothing across `src/`, and `switch.test.tsx`, `appearance-controls.test.tsx`, and `settings-popover.test.tsx` pass unedited, so the switch's role, `aria-checked`, and accessible name are unchanged
- [x] 2.4 In `segmented-control.module.css`, change `.option` from `border: 0` to `border: 1px solid transparent` and add `border-color: var(--border2)` to `.option[aria-checked="true"]`, and verify:
  - the segmented pins pass, including the "must not declare" pin;
  - the coverage case passes;
  - `segmented-control.test.tsx`, `appearance-controls.test.tsx`, `top-app-bar.test.tsx`, `responsive-collapse.test.tsx`, and `cats-invariance.conformance.test.tsx` pass unedited

## 3. Verification

- [x] 3.1 Run `npm test` and verify the whole suite passes, and that `git diff --stat` for this change, outside `openspec/`, lists only the six files owned by groups 1 and 2, with no `.tsx`, `.ts` source, or other stylesheet touched
- [x] 3.2 Run `npm run typecheck` and verify `tsc --noEmit` reports no error
- [ ] 3.3 Walk the running app with `JUMPHOUR_UI_PREVIEW=1` in Light, in explicit Dark, and in System with the OS set to dark, and verify:
  - on `/dev/ui`, the danger button's label is white on red in light and dark ink on light red in dark, and hovering changes only the fill, never dimming the label;
  - the switch knob is white in light in both positions, and graphite in dark in both positions, clearly visible on each track;
  - the chosen segmented option, in the gallery, in the top app bar's theme control, and in the settings popover, shows a thin grey border;
  - moving the choice with the arrow keys moves that border together with the separate indigo focus ring, and no option resizes and no neighbouring control shifts, with cats off and with cats on
