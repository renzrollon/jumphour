Groups 1–4 are file-disjoint and may run in parallel. Groups 5–7 each depend on groups 1–4 and are file-disjoint from one another. Group 8 depends on 5–7, group 9 on 8, group 10 on 9. Every group owns the files named in its heading and MUST NOT edit another group's files. Interactive component tests opt in with the `// @vitest-environment jsdom` docblock; static render assertions keep using `renderToStaticMarkup`.

## 1. Flow contract and availability gate — `src/lib/flows/flow-controller.ts` (+ `.test.ts`)

- [ ] 1.1 Define `FlowController` with three optional members (`compose`, `launch`, `promote`) and the handler signatures each takes, and verify a type test that `{}` is assignable and that omitting a member is not a type error
- [ ] 1.2 Implement `flowEntryState(availability, handler)` returning `{ enabled: true }` or `{ enabled: false, reason }`, passing the provider's `reason` through verbatim when availability is `unavailable`, and verify the returned reason is byte-identical to the provider's string
- [ ] 1.3 Return a not-connected reason when availability is `available` but the handler is absent, and verify all four combinations of availability × handler presence produce the expected enabled/reason pair
- [ ] 1.4 Add an assertion that this module imports nothing from React, `next/*`, `src/server/`, or `src/app/dev/ui/`, and verify the test fails if such an import is added

## 2. Compose form logic — `src/lib/flows/compose-form.ts` (+ `.test.ts`)

- [ ] 2.1 Define `ComposeValues` (title, problem, links text) and `ComposeState` (`editing | submitting | error`) carrying entered values in every variant, and verify a state constructed as `error` still exposes the values it was given
- [ ] 2.2 Implement `isBlank()` trimming over all Unicode whitespace, and verify a non-breaking space, a tab, and an ideographic space each count as blank while `"  Retry finance exports  "` does not
- [ ] 2.3 Implement `validateCompose()` producing per-field errors with the Title error text "Add a title so the idea is recognizable on the board.", and verify a missing title and a missing problem statement each report on their own field only
- [ ] 2.4 Implement `parseSupportingLinks()` splitting on line breaks and commas, discarding blank entries, preserving order and duplicates, and verify `"https://a,,\n \n,https://a"` yields exactly two links with no error
- [ ] 2.5 Accept only `http:` and `https:` schemes and return every rejected entry by its original text, and verify `javascript:alert(1)` and `mailto:someone@example.test` are both named as rejected and neither is submitted or rewritten
- [ ] 2.6 Trim surrounding whitespace from the submitted title and problem statement, and verify the emitted compose intent carries the trimmed values while the in-form values are untouched

## 3. Launch session logic — `src/lib/flows/launch-session.ts`, `src/lib/flows/launch-copy.ts` (+ `.test.ts` each)

- [ ] 3.1 Define `PREFLIGHT_CHECKS` as the five labelled checks in prototype order (Claude Code available on this workspace; Interlock command available in repository; Repository access; Working directory matches selected repository; No other Jumphour session running) and `PreflightStatus` as `not checked | checking | ok | failed | skipped`, and verify the exported order and labels match the spec list exactly
- [ ] 3.2 Define `LaunchSheetState` as `config | checking | error | running`, with `running` carrying a nullable host CLI slot and the bound card/repository/working directory, and verify each variant can be constructed without a timer
- [ ] 3.3 Implement `applyPreflightResult()` so a `failed` check marks every later check `skipped` and no later check can become `ok`, and verify a failure at index 1 leaves indexes 2–4 `skipped`
- [ ] 3.4 Implement a reset transition returning `error` → `config` with all five checks back to `not checked`, and verify the card binding survives the reset and no command has been emitted
- [ ] 3.5 Implement `commandForCardKind()` mapping the Idea lane to `interlock:spec` and the OpenSpec change lane to `interlock:ship`, and verify the two middle/PR lanes are rejected at the type level rather than defaulting to `interlock:spec`
- [ ] 3.6 Define `LAUNCH_ERROR_COPY` for `unavailable`, `no-interlock`, `mismatch`, `active-session` with the locked titles and bodies, interpolating the command from `commandForCardKind()`, and verify the `no-interlock` body names `interlock:ship` for a change card and `interlock:spec` for an Idea with otherwise identical wording
- [ ] 3.7 Expose per-failure recovery affordances as data (try again; return to repository selection; open active session; back to board), and verify `mismatch` offers return-to-selection and `active-session` offers open-active-session and neither offers a queue action

## 4. Change-name and promote logic — `src/lib/flows/change-name.ts`, `src/lib/flows/promote.ts` (+ `.test.ts` each)

- [ ] 4.1 Implement `canonicalChangeName()` as one normalization — Unicode normalize, fold accents to base letters, lowercase, non-`[a-z0-9]` runs to a single hyphen, trim edge hyphens, first four hyphen words — and verify `"  ...Give FINANCE Éxport   Failures/Retries — an actionable path!!  "` yields `give-finance-export-failures`
- [ ] 4.2 Return an empty name for input with no alphanumeric content, and verify `"— … ///"` yields `""` rather than hyphens or an invented placeholder
- [ ] 4.3 Implement `isValidChangeName()` requiring non-empty, lowercase alphanumerics separated by single hyphens with alphanumeric ends, and verify `-add--keys-`, `Add Idempotency Keys!`, and `""` are each rejected and none is silently repaired
- [ ] 4.4 Implement `derivePromoteTargets(name)` returning the branch `spec/<name>`, the three previewed paths under `openspec/changes/<name>/`, and the requested pull-request title `Add OpenSpec change: <name>`, and verify all four derive from the same canonical string in one call
- [ ] 4.5 Define `PromoteDialogState` as `configure | progress | success | error`, with `success` carrying result-sourced pull-request number/title/link and artifact links and `error` carrying the failed step index and reported reason, and verify no pull-request number appears as a literal anywhere in the module
- [ ] 4.6 Define `PROMOTE_STEPS` (Validating change name; Creating branch; Writing OpenSpec artifacts; Opening GitHub pull request) and `PromoteStepStatus` as `waiting | in progress | done | failed`, and verify the exported order matches the spec
- [ ] 4.7 Implement `applyPromoteProgress()` so a failure at step 2 leaves steps 1 `done`, 2 `failed`, and 3–4 not advanced, and verify a failed run produces no success state
- [ ] 4.8 Implement the choose-a-different-name transition returning `error` → `configure` with repository and change name intact, and verify the derived branch and previewed paths update together when the retained name is then edited

## 5. Compose idea dialog — `src/app/components/flows/compose-idea-dialog.tsx`, `.module.css` (+ `.test.tsx`)

- [ ] 5.1 Render the dialog labelled `Compose idea` with the helper copy, exactly the Title / Problem / opportunity / Supporting links inputs, and a footer with the Manual source badge and "Created in Jumphour", and verify no repository control and no owner control is present in the rendered output
- [ ] 5.2 Mark both required inputs required to assistive technology and associate each inline error with its input, and verify the Title error is reachable through the input's accessible description and is announced when it appears
- [ ] 5.3 Render the rejected-link report naming each rejected entry, and verify a submission with one valid and two invalid links shows both invalid entries by their original text
- [ ] 5.4 Disable the primary action and announce it busy while `ComposeState` is `submitting`, keeping every entered value rendered, and verify a second activation while submitting emits exactly one compose intent
- [ ] 5.5 Refuse Escape and backdrop dismissal while submitting and allow both once the state resolves, and verify dismissal works again after an error state is shown
- [ ] 5.6 Emit the created idea identifier to the caller on success and keep the dialog mounted with its values on failure, and verify a failure leaves the Title text unchanged and reports no identifier
- [ ] 5.7 Render the entry control from `flowEntryState()` with its reason exposed to assistive technology, and verify the disabled control opens no dialog for both the unavailable and the no-handler case
- [ ] 5.8 Use change 1's dialog primitive and `SourceBadge`, labelled through change 2's `sourcePresentation()`, rather than local markup for the overlay and the Manual badge, and verify the component file contains no bespoke focus-trap or badge styling

## 6. Launch session sheet — `src/app/components/flows/launch-session-sheet.tsx`, `src/app/components/flows/preflight-list.tsx`, `.module.css` (+ `.test.tsx` each)

- [ ] 6.1 Render the sheet header with the card's source badge, title, source key, snapshot reference, and the subtitle "Attended session · bound to one card and one repository", and verify no control exists for adding a second card or repository
- [ ] 6.2 Render the repository selector over supplied options keyed by canonical repository identifier and the working directory from the selected option, and verify a renamed repository keeps its selection and produces no duplicate option
- [ ] 6.3 Render the command preview, the change path for a change card, and the matching primary action label, and verify changing repository updates the working directory while leaving the command and change path unchanged
- [ ] 6.4 Disable the primary action and state the reason when the repository list is empty or a change card has no change path, and verify neither case falls back to previewing `interlock:spec`
- [ ] 6.5 Render the five preflight checks with a text status each in `preflight-list.tsx`, and verify each status is readable with color and decorative glyphs removed and that `skipped` follows a `failed` check
- [ ] 6.6 Render the four locked failure states with their titles, bodies, and recovery actions, including the mismatch state's selected-repository and detected-CLI-directory rows and the active-session state's card/repository/command summary, and verify each body matches the spec text
- [ ] 6.7 Render the running phase from the host-supplied CLI slot, showing the repository, working directory, a textual session-active indicator, and the Interlock governance note, and verify the slot content is rendered verbatim
- [ ] 6.8 Render the explicit "CLI unavailable" state when the slot is absent or whitespace-only, and verify no prompt character, command echo, or terminal-styled empty region is rendered in that case
- [ ] 6.9 Offer only "Exit session" while running and refuse Escape and backdrop dismissal while running, and verify no stop, queue, retry, approve, schedule, or routing control is present and that a configuring sheet still dismisses on backdrop click
- [ ] 6.10 Render no completion, success, or failure claim for the launched command anywhere in the sheet, and verify a snapshot of every rendered string in the running and post-exit states contains no completion language
- [ ] 6.11 Render the start-spec and start-ship entry controls from `flowEntryState()`, and verify both disabled cases expose the supplied reason and open no sheet

## 7. Promote dialog — `src/app/components/flows/promote-dialog.tsx`, `.module.css` (+ `.test.tsx`)

- [ ] 7.1 Render the Configure step with the title "Create OpenSpec change without agent", the step label, the idea header with snapshot reference, the repository selector, the change-name input with its inline guidance, the derived branch, the three previewed paths, and the result note, and verify each string matches the spec text
- [ ] 7.2 Bind the branch and previewed paths to `derivePromoteTargets()` of the current name, and verify editing the name updates all four derived values in the same render
- [ ] 7.3 Disable the create action and show inline format guidance associated with the input for an invalid or empty name, and verify no promote intent is emitted for `Add Idempotency Keys!`
- [ ] 7.4 Render the progress step with the four steps and their text statuses in a politely announced region, plus the close-and-continue note, and verify statuses are present as text and no string describes an agent working, thinking, or deciding
- [ ] 7.5 Refuse Escape and backdrop dismissal during progress while keeping the explicit close control working, and verify closing emits neither a cancellation nor a success
- [ ] 7.6 Render the success step entirely from the reported result — branch, pull-request number/title/link, artifact links — and verify no pull-request number is present when the result omits one and that the component source contains no literal number
- [ ] 7.7 Route every result-sourced href through change 3's safe-link helper, and verify a `javascript:` pull-request link renders as text while its number and title still display and an `https:` artifact link still renders as a link
- [ ] 7.8 Render the error step with the failed-step marking, the reported reason naming the branch, the unchanged-issue statement, and both "Choose a different name" and "Try again", and verify choosing a different name returns to Configure with repository and name intact
- [ ] 7.9 Emit one promote intent per activation carrying idea, canonical repository identifier, and canonical change name, and verify a double activation emits exactly once and the component issues no network request
- [ ] 7.10 Render the promote entry control from `flowEntryState()` at lower emphasis than the attended launch control, and verify both controls have distinct accessible names and remain keyboard reachable

## 8. Flow host and board seam — `src/app/components/flows/flow-host.tsx`, `src/app/components/flows/index.ts`, plus the single optional `flows` prop on the board screen and `src/app/page.tsx`

- [ ] 8.1 Implement the flow host owning which flow is open and rendering the three surfaces from a supplied `FlowController`, and verify opening one flow closes any other and that no flow opens without its handler
- [ ] 8.2 Supply the compose, start-spec, start-ship, and promote entry controls into the board toolbar and detail action slots from changes 2 and 3, and verify each slot receives a control whose enabled state comes from `flowEntryState()`
- [ ] 8.3 Add one optional `flows?: FlowController` prop on the board screen and thread it to the flow host without changing any board or detail behavior, and verify the diff to files owned by changes 1–3 contains only the prop and the composition
- [ ] 8.4 Render the board from `src/app/page.tsx` with no controller supplied, and verify a production render shows Compose idea disabled with the provider's own reason, renders no card actions because the production provider returns no cards, and opens no dialog; then verify with a fixture card whose three actions are `unavailable` that Start spec, Start ship, and Promote each render disabled with their reasons
- [ ] 8.5 Restore focus to the control that opened a flow when that flow closes, and verify focus restoration for compose, launch, and promote

## 9. Preview gallery — `src/app/dev/ui/flows/page.tsx`, `src/app/dev/ui/flows/simulated-controller.ts`, `src/app/dev/ui/fixtures/flows.ts`

- [ ] 9.1 Add the flows fixture file with sample cards, repositories with working directories, and the prototype's CLI transcript clearly labelled as fixture content, and verify no module outside `src/app/dev/ui/` imports it
- [ ] 9.2 Implement the simulated controller as a `FlowController` reproducing `launch=success|unavailable|no-interlock|mismatch|active-session` by failing preflight at indexes 0, 1, 3, and 4, and verify each outcome leaves the remaining checks `skipped`
- [ ] 9.3 Extend the simulated controller with `promote=success|branch-exists`, failing `branch-exists` on Creating branch, and verify the success path reports a fixture pull-request number that the dialog renders from state rather than from its own source
- [ ] 9.4 Render `/dev/ui/flows` with the preview guard called on the page itself, the persistent "Preview — fixture data" label, and query-string scenario selection, and verify the page responds 404 when `JUMPHOUR_UI_PREVIEW` is unset
- [ ] 9.5 Add a boundary test asserting no file under `src/app/components/flows/` or `src/lib/flows/` imports from `src/app/dev/ui/`, `src/server/`, or calls `fetch`, and verify the test fails when such an import is introduced

## 10. Verification

- [ ] 10.1 Run `npm test` and verify the whole unit suite passes, including the new flow reducer, component, boundary, and preview-guard tests
- [ ] 10.2 Run `npm run typecheck` and verify `tsc --noEmit` reports no error
- [ ] 10.3 Confirm this change added no dependency, no migration, no SQL, no API route, and no GitHub call, and verify `package.json` and `src/server/` are unmodified in the diff
- [ ] 10.4 Walk `/dev/ui/flows` through all five launch outcomes and both promote outcomes in light and dark themes with `JUMPHOUR_UI_PREVIEW=1`, and verify every state in the three specs is reachable and no state conveys status by color alone
