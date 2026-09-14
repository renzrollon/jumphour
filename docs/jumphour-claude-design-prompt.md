# Jumphour — Claude design prompt

## How to use

Paste the prompt below into Claude's design, artifacts, or UI-generation surface. Ask it to generate a high-fidelity, responsive, connected product prototype—not a static wireframe. If that surface supports multiple routes or screens, use the named screens as routes; otherwise make the main board interactive with overlays and state switchers that expose every required state.

---

You are designing and generating a polished, working product UI for **Jumphour**. Build a serious, desktop-first web application prototype with realistic data, interaction states, and responsive behavior. This is not a wireframe, a generic dashboard, Jira, Linear, or an AI chat product.

## Product truth: do not reinterpret this

Jumphour is the shared **idea-to-spec board** for software teams using agent-assisted development. It sits at the visible handoff into execution:

- **Interlock** governs and runs spec-driven work, including the `interlock:spec` and `interlock:ship` commands.
- **Checkpoint** is a compact, phone-first approval surface for a single human decision.
- **Escapement** schedules approved work for unattended execution.
- **Jumphour** is where a PM, engineer, or agent-visible team selects intent, starts one attended Interlock command in an embedded Claude Code CLI, and sees the resulting OpenSpec change and GitHub pull request evidence.

The board sequence is exactly:

`Idea → OpenSpec change → In progress → PR/MR`

These are **derived states**, not manually controlled workflow statuses. Cards are convenient views over source facts; they are never the source of truth. Do not make columns editable status buckets. Do not offer drag-and-drop to change state.

Ideas can originate from:

1. GitHub Issues, accessed through MCP
2. GitLab issues, accessed through MCP
3. Jira, accessed through MCP
4. A manually composed idea

Every imported idea has a captured snapshot and an outbound permalink to its source. Jumphour is read-only with respect to those sources: it never writes comments, labels, assignees, or status changes back to GitHub, GitLab, or Jira.

The primary agent handoff is user-triggered and attended: from one selected **Idea**, open Claude Code CLI inside Jumphour in the selected repository and run `interlock:spec`; from one selected **OpenSpec change**, do the same and run `interlock:ship`. Interlock—not Jumphour—governs what those commands do. The user remains present in the CLI.

**Promote to OpenSpec** remains an optional non-agent path: it can create OpenSpec files on a GitHub branch and open a draft pull request, but it is lower emphasis than starting `interlock:spec`. The generated UI should make the distinction clear.

### Locked listen/trigger model

Every lane has visible **regular interval listening**: show `Listening every 5 min` and a human-readable per-lane **last-heard** time/state (for example, `Last heard 2 min ago`, `Delayed · retrying`, or `Last successful listen 14 min ago`). Listening is a read-only projection, not real-time synchronization.

- **Idea:** Show a manual `Load ideas` action. It immediately reads selected GitHub Issues, GitLab issues, Jira via MCP, or the Manual inbox; it never writes back. This is distinct from refreshing an already captured snapshot. A user may select one eligible card and invoke `Start spec with Claude Code`, which opens the attended embedded CLI in its selected repository and runs `interlock:spec`; this is an agent launch, not a listener refresh.
- **OpenSpec change:** Its listener reconciles repository OpenSpec artifacts and associated agent-session evidence. There is no manual status or manual-refresh control for this lane. A user may select one eligible card and invoke `Start ship with Claude Code`, which opens the attended embedded CLI and runs `interlock:ship`; this is an agent launch, not a listener refresh.
- **In progress:** Its listener reconciles implementation evidence from repository facts and associated agent-session evidence. There is no manual status or manual-refresh control for this lane.
- **PR/MR:** Show a manual `Fetch PRs/MRs` action that immediately uses MCP to read GitHub pull requests and GitLab merge requests in scope. It never comments, reviews, labels, or otherwise writes to either host.

For the middle lanes, display read-only session-log evidence from an eligible Cursor agent session, Claude Code session, or Interlock artifact—including a Claude Code session launched from Jumphour—only when it is securely linked to the repository/branch/change/PR/MR. Use compact, factual cues such as `Cursor session · implementation file activity · observed 3 min ago` or `Claude Code · proposal drafting · observed 11 min ago`, with an authorized evidence/details link. Do not render raw transcripts by default. Session evidence can explain **OpenSpec change** when it is analysis/spec work and **In progress** when it records implementation work before a commit; it cannot move a card to PR/MR, claim completion, approve work, or give Jumphour control over an agent.

## Deliverable

Create a cohesive, high-fidelity application prototype, not a design document. Use real interface copy, plausible repositories, issue titles, dates, owners, and metadata. Include interactive navigation, filters, menus, dialogs, hover/focus states, and all named empty/loading/error states. The visual system should feel credible enough to hand to an engineering team.

Desktop is primary: a PM manages the board from a laptop and engineers work from a laptop. Mobile is usable for a quick glance, filtering, detail review, and manual composition, but must not imitate Checkpoint's 375px approval inbox.

Start in **light mode**, with the **cats theme off by default**. Provide both light and dark mode. Provide the optional cats theme only as a whimsical visual layer; it must never alter information architecture, copy, interaction patterns, density, or accessibility.

## Information architecture and screens

Create these connected screens and states. A left navigation rail can remain consistent, but keep it slim and product-specific.

### 1. Board — default desktop view

This is the primary screen. It shows a named workspace/repository context, such as:

- Workspace: `Platform delivery`
- Scope: `All repositories`
- Repositories visible in the filter: `acme/api-gateway`, `acme/customer-web`, `acme/mobile-shell`

Use a top app bar with:

- Jumphour wordmark/name and a small, restrained mark
- Workspace switcher
- Search: “Search ideas, specs, PRs, and MRs”
- Theme control (system / light / dark)
- Cats toggle, visibly off by default and labeled clearly
- User avatar/menu

Below it, use a compact board toolbar:

- A scope/repository filter
- Source filter (All sources, GitHub, GitLab, Jira, Manual)
- Assignee/owner filter
- A derived-status explanation affordance such as an `i` icon: “Column placement is calculated from source, OpenSpec, session, and PR/MR evidence.”
- A prominent `Compose idea` button
- A smaller `Load ideas` action with a source picker for GitHub, GitLab, Jira via MCP, and Manual inboxes; describe it as an immediate read, not syncing or writing back

The board itself has four horizontal columns on desktop, with deliberate widths, low visual noise, and a fixed contextual header:

1. **Idea** — “Captured, not yet promoted”
2. **OpenSpec change** — “Branch and change artifacts exist”
3. **In progress** — “Implementation evidence is active”
4. **PR/MR** — “Host review is open or ready”

Show a count, concise derived-evidence sublabel, `Listening every 5 min`, and a last-heard indicator on every column header. Make last-heard states visible without relying on color: `Last heard 2 min ago`, `Listening delayed`, or `Last successful listen 14 min ago`. Put `Load ideas` in the Idea header as well as the toolbar, and put `Fetch PRs/MRs` in the PR/MR header. The latter opens a small MCP-source menu for GitHub PRs and GitLab MRs. The OpenSpec change and In progress headers deliberately have no manual refresh/control. A selected Idea card/detail has the primary `Start spec with Claude Code` action; a selected OpenSpec change card/detail has `Start ship with Claude Code`. They are deliberate attended launches, not header-level polling controls. Columns should look like a high-quality workflow surface, not a task manager. Allow vertical scrolling inside the board region and preserve column headers. Use responsive horizontal board scrolling or a selectable single-column board on mobile; do not squash four columns into unreadable strips.

Populate it with 2–4 cards per column using varied sources and situations. Include realistic examples such as:

- GitHub issue: “Support request-level idempotency keys”
- Jira / PAY-184: “Give finance export failures an actionable retry path”
- GitLab issue: “Expose tenant-level webhook delivery metrics”
- Manual idea: “Compare hosted runners against the overnight queue”
- OpenSpec change: `add-idempotency-keys`
- GitHub PR: `#482 Add retryable finance exports`
- GitLab MR: `!91 Add tenant delivery metrics`

Include at least one card that quietly indicates it was created by an agent or has agent-generated draft material, but do not make agents the visual center of the product.

### 2. Idea detail — desktop side panel or dedicated detail screen

Selecting an Idea card opens a well-composed detail view. On desktop, prefer a broad right-side panel that retains board context; on smaller screens, use a full-screen detail route.

The detail view must include:

- Source icon and badge, source key/issue number, and a clear external-link permalink
- Exact source title and source snapshot timestamp: “Snapshot captured 14 min ago”
- A compact source snapshot with description, acceptance context, and selected labels; visually distinguish it from live synced data
- A banner or annotation stating: “Read-only snapshot. Jumphour never writes back to this source.”
- Repository context, intended owner, related repository/project, and any linked OpenSpec change / PR/MR when present
- An activity/evidence timeline that explains the current derived board placement, including the relevant lane's interval, last-heard time, and any authorized session evidence
- A clearly primary `Start spec with Claude Code` action when the idea is eligible. It opens the in-app Claude Code CLI in the selected repository and runs `interlock:spec`.
- A secondary `Create OpenSpec without agent` / `Promote to OpenSpec` action for the optional direct GitHub artifact path
- An overflow menu containing non-destructive actions only: copy link, open source, archive local view / hide from board if desired. Do not offer source mutation actions.

For a Manual idea, show “Created in Jumphour” rather than a fabricated external source and retain the same evidence-oriented layout.

### 3. Compose idea

Create a focused compose dialog or page, not a chat box. It lets a person add a manually composed idea. Fields:

- Title
- Problem / opportunity
- Context and constraints
- Repository (required)
- Suggested owner (optional)
- Supporting links (optional)

Use useful helper copy: “Capture a decision-worthy idea. Promotion will create an OpenSpec change; it will not start implementation.” Include save/cancel behavior, validation, disabled/loading submission states, and an example validation error. On success, show the new Manual source badge and add the item to the Idea column.

### 4. Start an attended Claude Code session

This is the central interaction. Design it as a focused in-app session sheet/panel, not a chat product or generic terminal workspace. Each launch is explicitly bound to exactly one card and one repository; allow only one active Jumphour-launched embedded Claude Code session per user/workspace. The user must close or exit it before launching another.

**Idea launch**

From one Idea, show the selected immutable snapshot, repository selector, working directory, and command preview: `interlock:spec`. The primary action is `Open Claude Code and start spec`.

**OpenSpec change launch**

From one OpenSpec change card/detail, show the linked repository, OpenSpec change path, working directory, and command preview: `interlock:ship`. The primary action is `Open Claude Code and start ship`.

Before either action, show a concise preflight state for Claude Code availability, Interlock command availability, repository access, working-directory match, and active-session availability. On success, open an embedded, attended Claude Code CLI inside Jumphour and visibly run exactly the requested command. The user stays in that CLI; do not show run queues, approval controls, autonomous progress claims, or a Jumphour-owned completion state.

Include clear, non-destructive failure states:

- `Claude Code is unavailable` — “We can’t open the embedded CLI on this workspace. The board has not changed.”
- `Interlock is not installed` — “`interlock:spec` is unavailable in this repository. Install or configure Interlock, then try again.” Use analogous copy for `interlock:ship`.
- `Repository working directory mismatch` — identify the selected repository and detected CLI directory, block the command, and offer return to repository selection/configuration.
- `A Jumphour Claude Code session is already running` — show the existing session's bound card/repository and an `Open active session` action; do not queue a second launch.

When no attributable session log or repository artifact follows a launch, keep the card in its existing evidence-derived column and show `No session evidence observed yet` or `Session evidence unavailable`; never claim the command completed.

### 5. Promote to OpenSpec — optional non-agent confirmation and progress flow

This is a deliberate but secondary fallback. Design it as a lower-emphasis, multi-step modal/sheet for users who choose to create a conventional OpenSpec change without starting an agent.

**Step 1: Configure**

Show the selected idea and its immutable source snapshot reference. Include:

- Repository selector, prefilled from the idea
- Proposed change name, e.g. `add-idempotency-keys`, with inline format guidance
- Target branch, e.g. `spec/add-idempotency-keys`
- Concise file preview:
  - `openspec/changes/add-idempotency-keys/proposal.md`
  - `openspec/changes/add-idempotency-keys/tasks.md`
  - `openspec/changes/add-idempotency-keys/specs/...`
- A concise result note: “This creates files on a GitHub branch and opens a pull request. It does not update the original issue.”
- Clear Back / Create OpenSpec change actions

**Step 2: Creation progress**

Show a trustworthy, step-by-step progress state:

1. Validating change name
2. Creating branch
3. Writing OpenSpec artifacts
4. Opening GitHub pull request

Use asynchronous states, a clear non-blocking status, and a recoverable failure presentation. Never imply an agent is independently executing the work; this flow creates the spec artifacts and PR.

**Step 3: Success**

Show a compact success confirmation with:

- Branch name
- PR number, title, and external-link affordance
- Change artifact links
- “View OpenSpec change” and “Return to board” actions
- The board's resulting derived placement in **OpenSpec change**

Create an error version for a failed branch/PR creation with a concrete message, e.g. “We could not create `spec/add-idempotency-keys` because a branch with that name already exists.” Offer “Choose a different name” and “Try again”; do not pretend the original issue has changed.

### 6. Source health, loading, empty, and error states

Treat operational states as first-class design, not an afterthought.

Create visible, convincing examples for:

- **First-use empty board:** no ideas yet. Explain the two paths: connect/read from a source or compose an idea. Do not pitch a broad “project management” product.
- **Empty filtered results:** “No Jira ideas match this repository” with reset filters and compose actions.
- **Board loading:** skeletal column cards, persistent column headers with each lane's interval/last-heard state, and explicit source-fetching context rather than a blank page.
- **General source error:** a compact source status panel/badge that says which source could not be reached and when the last successful snapshot was captured. Existing snapshots remain visible and useful.
- **MCP source failed (Jira):** this must be a distinct state. Example copy:
  - “Jira via MCP is unavailable”
  - “We couldn’t refresh Jira snapshots for `Payments`. Your last captured Jira ideas are still shown.”
  - “Check the MCP connection or try again.”
  - Actions: `Retry Jira source`, `View connection details`
  - No invented Jira login, OAuth wizard, or direct Jira API configuration.
- **No repository access / GitHub creation error:** explain the limitation with an action that returns to configuration. Do not invent permission management.
- **Session-evidence unavailable or unlinked:** on an OpenSpec change or In progress card, retain repository-derived placement and show `Session evidence unavailable`, `No session evidence observed yet`, or `Needs attention · session not linked`. Do not turn absent logs into a completion, approval, or status transition.

The source-health view should distinguish stale snapshots, lane-listener delay, fetch failure, and no matching results. It must never describe refresh as bidirectional sync or make a failed session-log read look like failed implementation.

### 7. Settings / appearance surface

Use a small settings popover or a simple Settings screen with:

- Appearance: System, Light, Dark
- `Cats theme` toggle, default Off
- An accessible description: “Adds subtle cat accents without changing the board.”
- Source connection status list: GitHub, GitLab, Jira via MCP. This is health/status only, not a credentials setup experience.

When cats are on, use only restrained touches: a tiny cat silhouette in the empty-state illustration, a rare sleeping-cat accent in a non-critical empty area, or playful naming for an otherwise normal theme switch. No cat avatars on cards, cat-shaped controls, puns in critical copy, animated distractions, or information conveyed only through the theme.

## Card anatomy and board behavior

Every board card needs a consistent, information-dense hierarchy:

1. **Top row:** source badge/icon (GitHub / GitLab / Jira / Manual), source identifier where applicable, and a small age/snapshot indicator
2. **Primary content:** readable title, limited to a sensible two or three lines
3. **Context row:** repository, owner/avatar or “Unassigned,” and a short relevance label if present
4. **Evidence row:** the signal that derives its column placement, such as:
   - `Captured from GitHub #814`
   - `Change: add-idempotency-keys`
   - `Cursor session · implementation activity · observed 3 min ago`
   - `Claude Code · proposal drafting · observed 11 min ago`
   - `Claude Code · interlock:ship launched in acme/api-gateway · session active`
   - `GitHub PR #482 · review requested`
   - `GitLab MR !91 · ready for review`
5. **Footer:** timestamp and a discreet open/external affordance where appropriate

Cards should be clickable, have keyboard focus styling, clear hover state, and never rely on color alone. Cards do **not** have editable status controls, a drag handle, sprint points, story points, or a generic “AI confidence” score.

Source badges must be recognizable and text-labeled:

- GitHub: neutral dark/white mark with “GitHub”
- GitLab: its familiar warm orange accent with “GitLab”
- Jira via MCP: restrained blue badge reading “Jira · MCP”; treat it as a source integration, not the primary product brand
- Manual: a neutral ink/gray badge reading “Manual”

Use status/evidence chips sparingly. The central visual object remains the idea/spec/PR title and its evidence trail, not a field of badges.

## Role-sensitive cues without separate products

The same board serves multiple people. Make their needs visible through cues, not three separate dashboards:

- **PM:** source context, snapshot freshness, concise problem framing, ownership, and a safe promote flow. Copy should explain what gets created.
- **Engineer:** repository, branch, change name, artifact paths, PR/MR state, session-evidence freshness, and concrete failure recovery.
- **Agent-assisted work:** a subtle provenance cue such as “Drafted with agent assistance” or an activity item showing generated artifact preparation or implementation evidence. The only launch surface is the focused, one-card embedded Claude Code CLI panel for `interlock:spec` or `interlock:ship`; it is traceability and attended handoff, not an animated agent control room. Do not include agent chat, model selectors, token metrics, raw transcript panels, or autonomous-run controls.

Show a small legend/help affordance explaining the derived lifecycle to all roles.

## Visual direction

Aim for **calm, editorial engineering software**: precise, trustworthy, and contemporary. It should complement the auditability and restraint of Interlock, Checkpoint, and Escapement while being unmistakably its own desktop planning surface.

Avoid the visual language of:

- Jira/Linear clones with huge colored status fields
- generic AI dashboards with gradients, sparkles, prompt boxes, or glowing orbit graphics
- dense DevOps monitoring consoles
- playful cat apps
- consumer social feeds

### Typography

- Use a modern, highly legible sans-serif such as Inter, Geist, or an equivalent.
- Make titles and hierarchy crisp rather than oversized.
- Use a monospace companion for branch names, repository slugs, issue keys, filenames, PR numbers, and artifact paths.
- Establish a clear scale: app/page titles, column titles, card titles, metadata, and helper text. Metadata must remain readable, not miniature.
- Favor short, concrete UI copy and sentence case.

### Color and surfaces

Light mode should be the default:

- Warm off-white or very pale neutral page surface—not pure blue-gray.
- White/elevated cards with subtle borders and soft but restrained shadows.
- Deep charcoal/ink text.
- One confident indigo or cobalt action color, used selectively for primary actions and active controls.
- Semantic green, amber, and red with text/icon reinforcement. Do not use rainbow columns.
- Source accents may appear in badges only and should not dominate cards.

Dark mode should be a true considered system, not inverted colors:

- Near-black charcoal canvas, layered graphite surfaces, pale text, carefully lifted borders.
- Muted but accessible indigo action color and source accents.
- Preserve the board's calm hierarchy and distinguish elevation without excessive glow.

Use a 4- or 8-point spacing rhythm, 10–12px card corners, compact but breathable card padding, and subtle dividers. Favor durable information density over enormous whitespace.

## Responsive behavior

- Design for a 1440px laptop desktop first, with a polished 1024px arrangement.
- On wide screens, all four columns are visible.
- On tablet/smaller laptop screens, preserve card readability with horizontal board scrolling and sticky controls, or a compact column navigator.
- On phones, provide a usable board overview with one selected column at a time, horizontal column navigation, search/filter access, and full-screen detail/promote flows.
- Keep the compose action available on mobile.
- Do not reproduce Checkpoint’s narrow 375px inbox design or turn this into a phone approval workflow.

## Accessibility and interaction quality

Meet a high accessibility bar:

- WCAG AA contrast minimum in light and dark themes.
- Visible keyboard focus states and logical tab order.
- Full keyboard access to cards, filters, menus, dialogs, theme/cats toggles, and board navigation.
- Correct dialog behavior: focus trap, Escape to close when safe, focus restoration.
- Buttons and icon-only controls need explicit accessible labels/tooltips.
- Do not use color, hover, motion, source icons, or cats-theme decoration as the only carrier of meaning.
- Honor reduced motion. Keep animation subtle and functional: dialog transition, skeleton shimmer with a reduced-motion alternative, and no decorative looping animation.
- Touch targets should be comfortable on mobile.

## Explicit exclusions — do not invent any of these

Do not add:

- Writing back to GitHub Issues, GitLab issues, or Jira: no comments, status transitions, label edits, assignee changes, or “sync back.”
- Writing back to GitHub pull requests or GitLab merge requests: no comments, reviews, labels, draft/ready changes, or status edits. `Fetch PRs/MRs` is an MCP read only.
- Dragging cards to change Jira/GitHub/GitLab status or any manual status control that contradicts derived board placement.
- Jira-like backlog/sprint planning, estimates, story points, epics, roadmaps, velocity, burndown, or team capacity views.
- Linear-like issue tracking and generic task management surfaces.
- Agent chat, prompt playgrounds, autonomous-run dashboards, model settings, tokens/costs, or “AI insights.”
- End-to-end execution controls, run approvals, Checkpoint-style decision inboxes, Interlock orchestration, Escapement scheduling, or controls for Cursor/Claude Code sessions beyond the two explicit user-triggered embedded launches: one Idea → `interlock:spec`, or one OpenSpec change → `interlock:ship`. Do not add stop, queue, retry, route, approve, schedule, babysit, or generic session controls. Session logs are otherwise read-only evidence, not a control plane.
- Preview databases, database explorers, schema designers, environment dashboards, or deployment controls.
- Authentication/onboarding flows, billing, team administration, or invented source credential/OAuth setup.
- A broad analytics dashboard.

Do not use vague placeholder text, lorem ipsum, “Task 1,” “Project Alpha,” or fake metrics. Use the provided product language and realistic software-delivery examples.

## Final quality bar

Make the prototype feel internally consistent, implementation-aware, and ready for a product critique. The user should immediately understand:

1. This board captures ideas from sources without mutating them.
2. Every lane shows when it listens and last heard; only Ideas and PR/MR expose their defined manual read actions.
3. Status comes from observable repository, host, and session evidence—not manually moved cards.
4. A user can select exactly one Idea to open the attended in-app Claude Code CLI and run `interlock:spec`, or one OpenSpec change to run `interlock:ship`; Interlock retains execution governance and Jumphour does not approve, schedule, or babysit the session.
5. Optional Promote creates OpenSpec artifacts on a GitHub branch and draft PR without updating the source issue; it is lower emphasis than the primary agent path.
6. Jumphour is the front of a deliberate spec-driven delivery loop—not another issue tracker, Interlock replacement, or generic AI tool.

Show the default populated board in light mode, make dark mode and cats-off/default state available, and include the named loading, empty, source-error, Jira-via-MCP failure, primary agent-launch preflight/success/failure, promotion success, and promotion failure states.

---
