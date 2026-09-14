# Jumphour epic brief

> Explore-deep outcome — planning only. This brief turns the locked product direction into decisions, boundaries, and candidate OpenSpec changes. It does not create those change artifacts or prescribe implementation.

## 1. Context and product position

Jumphour is a team-facing, GitHub-write-plane board for moving a piece of product intent from an idea into a reviewable OpenSpec change and then into a code PR/MR. It gives engineers, coding agents, and PMs one visible lifecycle without becoming another work-tracking system.

The product is deliberately narrow:

```text
Read-side intent and evidence            GitHub write change plane
─────────────────────────────            ───────────────────────
GitHub Issues ─┐
GitLab issues ─┼─ MCP adapters ──>       OpenSpec files ──> branch ──> PR
Jira ──────────┤      snapshots                  │
Manual input ──┘                                GitHub / GitLab PR/MR facts
Agent sessions ── read-only evidence             │
         │                                         │
         └──────────────> Jumphour lane projection ──> Workflow UI
                              Idea → OpenSpec change → In progress → PR/MR
```

The board is a projection, not an editable process engine. Its primary deliberate handoff is a user choosing one Idea and starting an attended, embedded Claude Code CLI session in the selected repository with `interlock:spec`. From one OpenSpec change card, a user can similarly start `interlock:ship`. **Promote** remains an optional, thinner non-agent path that creates OpenSpec artifacts on a GitHub branch and opens a draft PR when a user intentionally wants that direct handoff. Every lane listens on a regular interval; its other triggers are deliberately narrow and read-only. Later-column placement is calculated from repository, host, and associated session evidence—not manually changed by a user.

This complements the existing delivery loop:

- **Interlock** remains the spec-driven, policy-gated agent execution system; its `interlock:spec` and `interlock:ship` commands govern the attended work Jumphour may initiate.
- **Checkpoint** remains the phone-first human approval surface.
- **Escapement** remains the unattended runner and scheduler.
- Jumphour owns neither execution policy, approval, scheduling, nor a generic agent desktop. It provides one narrowly bound, attended in-app Claude Code launch surface for the two Interlock commands and makes the resulting intent-to-OpenSpec handoff visible and durable for a team.

The supplied portfolio and product-direction research constrain this brief; this document does not restate or alter those source documents.

### Why this product now

Coding agents increase the number of plausible branches and PRs, while product intent still arrives in separate issue trackers and conversations. The expensive failure is often earlier than implementation: an idea has no durable source record, has not become a repository-owned change, or has become a branch/PR that other people cannot relate back to the original intent.

Existing issue trackers are optimized for broad planning, assignment, reporting, and mutable workflow configuration. Git hosts are optimized for branches, commits, pull requests, and review. OpenSpec provides a repository-native representation of intended behavior. Jumphour should connect those three layers without replacing any of them.

### Product thesis

For a team that uses GitHub and OpenSpec, an idea should have:

1. an attributable, frozen source snapshot;
2. one explicit, user-attended path into a repository-owned OpenSpec change;
3. a status the board can derive from committed artifacts, associated read-only agent-session evidence, and GitHub/GitLab PR/MR facts; and
4. a linkable PR that contains the change record and, later, the implementation.

The artifact is more valuable than a mutable card because it can travel with the repository, be read by an engineer or agent, and survive changes to the board.

## 2. Users and jobs

### Engineer

**Primary job:** “Take a credible idea from the team’s intake into a reviewable repository change, then see where it really is without updating a second tracker.”

Engineers need to:

- browse and filter imported or manually entered ideas;
- inspect the original snapshot and source permalink before acting;
- choose the target GitHub repository and a valid OpenSpec change identifier;
- start `interlock:spec` for one selected idea in an attended embedded Claude Code CLI session;
- start `interlock:ship` for one selected OpenSpec change in that same narrowly bounded surface;
- optionally promote it directly to a GitHub branch and draft PR without an agent; and
- distinguish an unpromoted idea from a spec-only PR, active implementation, and review-ready PR.

They do **not** need a new assignment system, estimation workflow, sprint planner, or a second place to review code.

### Coding agent

**Primary job:** “Find the repository-owned intent and move work forward by making normal Git changes.”

Agents should consume the generated OpenSpec artifacts from the branch or PR using their existing host and workflow. Jumphour can open a user-attended Claude Code CLI in the selected repository and issue exactly `interlock:spec` for an Idea or `interlock:ship` for an OpenSpec change; it does not add a proprietary runtime protocol. Their visible effect may be ordinary GitHub evidence or read-only session evidence that they are drafting a spec or implementing against it. Session evidence is an observed trace, never a Jumphour completion claim.

An agent may be the author of commits, but Jumphour does not schedule it, supervise it, approve it, or claim that it has completed a specification. Those functions remain with the agent host and the existing execution products.

### Product manager

**Primary job:** “Provide high-quality product intent and see whether it became a concrete engineering change, without operating an engineering tracker.”

PMs need to:

- add a manual idea or browse intake snapshots they are allowed to see;
- retain a source permalink and the exact point-in-time content that was considered;
- understand the evidence-derived board stage and open the linked PR/MR; and
- collaborate on the proposal content before promotion when permitted.

PMs do not need to assign engineering work, reorder a backlog, transition statuses manually, or receive a two-way mirror of Jira/GitLab/GitHub issue state.

### Workspace/repository administrator

**Primary job:** “Install Jumphour for repositories and configure read-side intake without granting broader authority than required.”

Administrators install the GitHub App, select repositories, configure MCP-backed source adapters, manage access consistent with the host identities, and can disconnect sources. V1 should avoid a rich, product-specific RBAC model: GitHub repository access governs GitHub actions, while source-adapter authorization governs source visibility.

## 3. Current workflow and its failure points

### Current workflow

1. A PM, customer-facing engineer, or developer records an idea in GitHub Issues, GitLab, Jira, a document, or an ad hoc message.
2. An engineer finds it, reconstructs context from the source, and decides whether it deserves repository work.
3. The engineer or agent translates it into OpenSpec files in a local branch, often without a durable link to the source.
4. Agent-assisted implementation occurs in a branch, possibly through Interlock or another host.
5. A PR appears; reviewers have to infer the original intent and whether a meaningful spec exists.
6. The issue tracker, agent system, and GitHub UI each show a partial and sometimes inconsistent view.

### Problems

#### Intent provenance is weak

By the time a developer begins implementation, source text may have changed, been shortened, or become inaccessible. A URL alone does not preserve what was read. Copying issue content manually loses timestamps, source identity, and a clear boundary between quoted source material and later interpretation.

#### Promotion is informal and inconsistent

Creating an OpenSpec change is the high-leverage transition from a possibility to repository-owned work, but teams often perform it manually and differently. Some changes start as code branches, some as issues, and some never acquire a spec.

#### Status is duplicated or misleading

Jira-style status columns invite people to move a card because they believe it is “in progress,” even if the branch has not changed or the PR is still a draft. Conversely, GitHub is factual but does not tell a team how a source idea relates to an OpenSpec change. Teams end up updating two systems or trusting neither.

#### Agent work lacks a shared entry point

Agents can read files once a branch exists, but they do not solve the cross-team question of which idea is canonical or whether the resulting PR is rooted in a reviewed change record. The attended launches create a deliberate, visible entry point without transferring execution authority from Interlock to Jumphour.

#### Existing systems own adjacent, not this, work

Issue trackers already store source discussions. GitHub already hosts code review. Interlock, Checkpoint, and Escapement each own a later part of the delivery loop. Building their capabilities again would make Jumphour less clear and less adoptable.

## 4. Goals and success criteria

### Goals

1. **Make intake attributable.** Accept ideas from GitHub Issues, GitLab issues, Jira, and manual entry through MCP adapters; preserve a point-in-time snapshot plus a permalink for externally sourced ideas.
2. **Make agent handoff explicit and attended.** A permitted user can select one Idea and open Claude Code CLI in the selected repository to run `interlock:spec`, or select one OpenSpec change and run `interlock:ship`; Interlock retains its own policy and execution authority.
3. **Retain an optional repository-native non-agent path.** A permitted user can, when needed, transform an idea into OpenSpec files on a newly created GitHub branch and a GitHub draft PR through Promote.
4. **Make the board evidence-based.** Render the four locked workflow columns from source linkage, committed OpenSpec artifacts, associated session evidence, and PR/MR facts rather than a mutable local status field.
5. **Make listening legible and bounded.** Poll every lane on a regular interval, show its freshness, and expose only the lane-specific manual read and agent-launch actions described in the listen/trigger contract.
6. **Keep GitHub the write change plane.** The durable promoted change record, branch, commit history, and promotion PR live in GitHub. A GitHub App installation must be shareable across teams and repositories. GitLab MRs, when linked, are read-only evidence.
7. **Support human and agent collaboration.** The files generated by Interlock or optional Promote must be usable directly by engineers and coding agents without a Jumphour-only runtime.
8. **Show uncertainty honestly.** A missing or ambiguous repository, host, CLI prerequisite, or session signal must be shown as an actionable exception, not converted into a confident but invented state.
9. **Stay complementary.** Do not take over OpenSpec execution, review approval, agent scheduling, or broad portfolio management.

### Suggested measurable outcomes

These are product measures to validate after launch, not commitments for the first implementation:

- percentage of promoted ideas whose initial PR includes a source snapshot reference;
- time from first accepted idea to a created OpenSpec PR;
- percentage of board cards whose derived status is explainable from visible GitHub facts;
- duplicate-promotion rate, with users able to recover rather than silently create extra PRs;
- ratio of source retrieval failures shown with a useful error/retry path; and
- qualitative evidence that a PM or reviewer can trace a PR back to intent without searching another system.

### Definition of a useful v1

V1 is useful when a small GitHub team can install the App, let each lane poll its evidence at the defined interval, manually load ideas and PR/MR facts when needed, inspect frozen provenance, select one Idea to run `interlock:spec` or one OpenSpec change to run `interlock:ship` in an attended embedded Claude Code CLI session, use Promote only when the direct non-agent path is appropriate, and see work progress across the board from repository, host, and read-only session evidence.

## 5. Non-goals and hard boundaries

- **Not Jira or Linear.** No projects, sprints, estimates, assignees, roadmaps, custom workflow states, drag-and-drop status, backlog ranking, or planning analytics.
- **No two-way issue synchronization.** Source integrations neither comment, label, transition, assign, nor otherwise write to GitHub Issues, GitLab, or Jira. Snapshot refresh is a new read operation, not synchronization.
- **No source write-back.** Neither in-app launch nor Promote comments on, labels, transitions, assigns, or otherwise writes to GitHub/GitLab/Jira issues. Optional Promote's GitHub branch, commit, and draft-PR writes remain the only Jumphour-owned cross-system write path in this epic.
- **Not Interlock.** Jumphour does not decompose and run agent jobs, enforce implementation policy, or report agent verification as its own authority.
- **Not Checkpoint.** It does not become a phone approval inbox or add a universal approve/return control.
- **Not Escapement.** It does not run unattended jobs, schedule overnight work, or supervise sessions.
- **No generic agent desktop.** The sole exception is an embedded, attended Claude Code CLI launched from exactly one selected Idea or one selected OpenSpec change. There is no worktree dashboard, terminal fleet, chat room, cross-model control plane, queue, or background agent runner.
- **No preview database or environment system in v1.** The product may persist its own minimum metadata and source snapshots; it does not provision, clone, seed, or query an application preview database.
- **No end-to-end test platform in v1.** Do not require a browser test lab, Playwright orchestration, or E2E evidence before a card can progress.
- **No webhook graph required.** Regular lane polling and the two defined manual reads are sufficient. Avoid attempting to mirror every source and GitHub event in real time.
- **Launch two attended commands; otherwise read session logs only.** Jumphour may open Claude Code CLI in the selected repository and execute only `interlock:spec` from an Idea or `interlock:ship` from an OpenSpec change. It does not stop, approve, route, schedule, supervise, or otherwise control that session after launch; it may read eligible Cursor, Claude Code, or Interlock artifacts as evidence, and session evidence is not an execution-control protocol.
- **Cats are optional presentation only.** A cat-themed skin may change visual styling, never the data model, workflow vocabulary, information hierarchy, or product promise.

## 6. Constraints and design principles

### Source-of-truth hierarchy

| Concern | Source of truth | Jumphour’s role |
| --- | --- | --- |
| External issue content at intake | Stored snapshot plus source permalink | Preserve and display provenance; never synchronize it back |
| Manual idea content | Jumphour record | Preserve the entered content and author/time |
| Proposed engineering behavior | OpenSpec files in the GitHub branch/PR | Create and link them at promotion; display them |
| Branch, commits, and promotion PR state | GitHub | Read facts and derive board state |
| Linked GitLab merge-request state | GitLab via MCP | Read-only PR/MR evidence; never write back |
| Agent-session activity | Eligible Cursor, Claude Code, or Interlock artifacts, including a Jumphour-launched attended Claude Code session | Launch only the two locked Interlock commands; normalize attributable evidence; never control the session after launch |
| Board presentation | Deterministic projection from the above | Cache for performance if needed, but do not make it authoritative |

A product database is justified only for records that Git cannot hold well: workspace configuration, encrypted connector credentials/references, source snapshots, manual ideas, and links needed to find promoted work. It must not introduce a competing workflow-status database.

### GitHub App constraints

Jumphour must be distributable as a GitHub App, not a personal-token-only tool. Its GitHub repository permissions should be scoped narrowly enough to:

- read repository metadata, default branches, commits, and PRs;
- create a branch from a selected default-branch commit;
- write OpenSpec files and a promotion commit; and
- create the promotion PR.

Exact permission names and whether later implementation commits are authored through the App must be validated during design. The initial product should not need broad organization administration, Actions administration, issue write access, or access to repositories outside the installation.

### MCP intake constraints

All locked external idea sources are loaded through adapter boundaries backed by MCP. An adapter must normalize enough information to display and preserve:

- source kind (`github-issue`, `gitlab-issue`, `jira`, or `manual`);
- immutable external identifier when present;
- canonical permalink;
- title, body/description, visible state, labels/tags, author/display name, and source timestamps when available;
- fetch timestamp, adapter identity/version, and snapshot content hash; and
- an explicit authorization/error state when the adapter cannot read an item.

Adapters are read-only from Jumphour’s perspective. Their responses are untrusted input: imported text cannot be interpreted as commands, used to select a repository automatically, or silently copied into executable configuration.

### OpenSpec compatibility constraints

Jumphour should create an ordinary, inspectable OpenSpec change layout rather than invent a parallel specification format. A promoted change should be understandable in a checkout with no Jumphour access. The product must discover or ask for repository conventions rather than assuming every repository uses the same OpenSpec profile, capability structure, or templates.

### V1 operational constraints

- **Locked polling default:** every lane listens every five minutes by default. It records its last successful and last attempted listen time, applies bounded retry/backoff on a failure, and continues to show the last known projection with a stale/error state. The interval is visible per lane; any future configuration must be workspace-scoped and cannot imply event-stream synchronization.
- **No webhook graph required:** polling plus the lane-specific manual read triggers and user-triggered per-card launches below are sufficient for V1. Add webhooks only where later evidence proves they materially improve freshness without creating a mirror.
- Prefer GitHub API reads and configured MCP reads for current board status rather than shadow event processing.
- Persist enough idempotency state to recover promotion retries safely.
- A launch is always user-triggered, bound to one selected card and repository, and never initiated by an interval listener. At most one Jumphour-launched embedded Claude Code session may be active per user/workspace; a user must close or exit it before starting another.
- Before opening the CLI, validate that Claude Code is available, Interlock is installed with the requested command, and the selected repository maps to the intended CLI working directory. A failed preflight, wrong working directory, or already active session must leave the board unchanged and offer a concrete recovery path; do not queue, schedule, or retry launches automatically.
- Make source-data handling tenancy-aware. A snapshot from one installation/workspace must never appear in another.
- Treat imported markdown and links as untrusted display content; sanitize rendering and prevent cross-tenant link leakage.

## 7. Proposed change: the Jumphour workflow

### 7.1 Core objects

**Idea**

An intake record. It is either:

- an imported read-only snapshot from a configured MCP adapter, retaining its source permalink; or
- a manual idea entered in Jumphour, retaining author and creation time.

An idea is not an issue mirror. It has no remote status field that Jumphour writes. It can retain multiple fetched snapshots if users refresh intentionally, with one clearly marked as the snapshot used for promotion.

**Promotion**

An optional, intentional, idempotent non-agent operation linking one selected idea snapshot to one target GitHub repository and one OpenSpec change. It owns the created branch, initial commit, and draft PR references. It is a fallback for teams that want direct artifact creation; it is not the primary agent handoff.

**Attended agent launch**

A user-triggered, one-card-at-a-time launch record binding an Idea or OpenSpec change to one accessible repository and an embedded Claude Code CLI session. An Idea launch executes `interlock:spec`; an OpenSpec change launch executes `interlock:ship`. It records the selected entity, repository, intended working directory, requested command, launch time, and stable session reference if one is available. The record supports linkage and failure explanation; it is not a job, queue, approval, or completion record.

**OpenSpec change**

The repository-owned directory introduced by the promotion, conventionally under:

```text
openspec/changes/<change-name>/
  proposal.md
  design.md
  tasks.md
  specs/<capability>/spec.md
```

The exact generated files and paths must follow the target repository’s discovered OpenSpec configuration and templates. A repository without OpenSpec needs an explicit future decision; V1 must not silently create a malformed or invented structure.

**Board card**

A read model joining an idea/promotion record to its current GitHub branch, host PR/MR, and associated session evidence. It is not a mutable ticket. The card shows the direct source permalink, stored snapshot timestamp, GitHub branch/PR/MR links, derivation reason, and last observed time.

### 7.2 Intake flow

1. The Idea lane listener reads configured inboxes on its regular interval, or a user selects a configured inbox/manual inbox and invokes **Load ideas**.
2. Jumphour invokes the appropriate MCP adapter or reads the local manual inbox without mutating it.
3. It displays candidate items and their available source metadata without mutating the source system.
4. When a user saves an item to the inbox, Jumphour records an immutable snapshot and canonical source permalink. It records the fetch time and adapter details.
5. The user can request an explicit refresh, which creates a later snapshot rather than overwriting the earlier record. The board identifies which snapshot was promoted.
6. A source-read failure is a visible state with retry/configuration guidance; it does not delete a prior snapshot or claim that the issue has disappeared.

Manual input uses the same idea model but has no external permalink. It should require a title and description, and may accept optional supporting links. The UI must clearly label it as manually entered rather than imported.

### 7.3 Primary agent handoff: attended Interlock launch

The primary agent path is **Idea → `interlock:spec`** and **OpenSpec change → `interlock:ship`**. It is a deliberate user action, not a listener trigger, interval job, or autonomous recommendation.

1. A user opens one eligible Idea, selects/validates its target repository, and invokes **Start spec with Claude Code**. From one eligible OpenSpec change card, a user instead invokes **Start ship with Claude Code**.
2. Before opening the embedded CLI, Jumphour confirms that Claude Code is available, Interlock is installed and exposes the required command, the repository is accessible, and the CLI working directory is the selected repository. It also confirms that the user has no other active Jumphour-launched embedded Claude Code session in that workspace.
3. Jumphour opens an attended Claude Code CLI inside Jumphour, bound to that one entity and repository, and runs exactly `interlock:spec` for the Idea or `interlock:ship` for the OpenSpec change. The user remains present in the CLI; Interlock governs the workflow and any policy or follow-on work.
4. Jumphour records only the minimal stable launch/session linkage needed for the existing OpenSpec change and In progress listeners to read authorized session evidence. It does not infer completion, move a card, or announce success solely because the command was issued.
5. The CLI may create repository artifacts or implementation evidence through Interlock. The regular listeners observe that evidence under the normal projection rules; no direct status mutation occurs at launch.

Launch failures are explicit and non-destructive:

- **Claude Code unavailable:** explain that the embedded CLI cannot be opened and retain the current card state.
- **Interlock unavailable:** explain that the requested `interlock:spec` or `interlock:ship` command is not installed; do not substitute another command.
- **Repository working directory mismatch:** identify the selected repository and detected CLI directory, block the command, and offer return to repository selection/configuration.
- **Session already running:** link the existing attended session and block a second launch until it exits or is closed; do not queue the new request.

If the session emits no attributable artifact or implementation evidence, the board remains in its repository-derived state and shows the absence or unavailability of session evidence rather than claiming progress.

### 7.4 Optional non-agent Promote flow

**Decision: Promote remains available as an optional non-agent path, but it is secondary to the attended Interlock path.** It is shown as a lower-emphasis “Create OpenSpec without agent” action from an Idea detail, not as the primary card action. Promotion is the only Jumphour-owned cross-system write transition in the initial epic:

1. A permitted user opens an idea snapshot and chooses a GitHub App-installed repository.
2. Jumphour shows existing promotions for the same snapshot/repository and related open GitHub PRs before it writes anything. The user can follow an existing result rather than unknowingly duplicating work.
3. The user supplies or confirms:
   - a human-readable OpenSpec change name;
   - the target capability/path when the repository cannot infer it;
   - a concise problem statement, desired outcome, non-goals, and acceptance notes; and
   - optional implementation/research notes, clearly distinguished from the frozen source snapshot.
4. Jumphour validates the target repository’s OpenSpec layout and the proposed change path. It fails closed when the App cannot safely determine where to write.
5. It creates a branch from the repository default branch, writes the planned OpenSpec change files, and makes a single initial commit.
6. It opens a **draft GitHub PR**. The PR body links the original source permalink, identifies the snapshot timestamp/content hash, names the OpenSpec change path, and explains that no source system was updated.
7. It records the resulting GitHub identifiers and returns the user to the board/PR.

The files should preserve provenance without treating source text as specification. For example, `proposal.md` can include a short “Source context” section with the canonical URL, snapshot timestamp/hash, and a human-authored or reviewed interpretation. The full snapshot remains in Jumphour’s protected store, rather than being copied wholesale into a public repository by default.

Promotion must be safe to retry. If the branch commit succeeds but PR creation fails, Jumphour should surface the existing branch and offer a recovery action that creates the missing PR after checking idempotency markers. It must not create a second branch just because the network response was lost.

### 7.5 Listen/trigger contract and workflow projection

The four workflow columns are a **view**, calculated from evidence. They are intentionally not draggable. Each lane has one regular polling listener. The only manual **read** triggers are Load ideas and Fetch PRs/MRs; attended agent launches are separate, per-card actions and do not refresh or mutate a lane directly. A manual read trigger requests a fresh read; it neither changes a card's status nor writes back to an issue, PR, MR, or agent system.

| Lane | Regular interval listener (locked default: every 5 minutes) | Explicit manual read / launch action | Read and action boundary |
| --- | --- | --- | --- |
| **Idea** | Poll configured GitHub Issues, GitLab issues, and Jira MCP inboxes plus the local manual inbox for new/changed candidates and saved snapshot freshness. | **Load ideas** lets the user select GitHub, GitLab, Jira via MCP, or Manual inboxes and run an immediate read. On one selected eligible Idea, **Start spec with Claude Code** opens the embedded CLI and runs `interlock:spec`. | MCP/source reads and local manual records only; no issue mutation or synchronization. The launch is attended, user-triggered, and bound to the selected repository. |
| **OpenSpec change** | Reconcile the linked repository's expected OpenSpec artifacts and associated session evidence. | No manual listener refresh. On one selected eligible OpenSpec change, **Start ship with Claude Code** opens the embedded CLI and runs `interlock:ship`. | Repository reads plus eligible session artifacts. The launch is attended, user-triggered, and bound to the selected repository; otherwise never drive an agent. |
| **In progress** | Reconcile implementation-path Git evidence and associated session evidence. | None in V1; the scheduled listener is the freshness mechanism. | Repository reads plus eligible session artifacts; never drive an agent. |
| **PR/MR** | Poll linked GitHub PR and GitLab MR facts. | **Fetch PRs/MRs** runs an immediate MCP read for GitHub PRs and GitLab MRs in the current scope. | Host reads only; no review, status, label, comment, or issue write-back. |

`Load ideas` may show candidates before an item is saved as an immutable snapshot. A per-item snapshot refresh remains a read that creates a newer snapshot; it is not synchronization. `Fetch PRs/MRs` may surface an unlinked result for reconciliation, but it must not manufacture a promotion relationship.

#### Session-evidence contract

“Agent session logs” means read-only, access-controlled artifacts produced by an existing **Cursor agent session**, **Claude Code session**, or **Interlock run/session**, including the narrowly scoped Claude Code session launched from Jumphour. V1 may ingest only normalized facts from an artifact: system/provider, stable session or run identifier, artifact URI/reference, observed timestamp, repository, branch/worktree when available, linked PR/MR or expected OpenSpec change path when available, and evidence type. Raw transcript text is not a status command and should be shown only through an authorized, minimally necessary evidence view.

An adapter may associate session evidence with a promotion only through a stable repository plus one of: promotion/expected-change identifier, branch, GitHub PR number/URL, or GitLab MR IID/URL. A title-only or natural-language similarity match is insufficient. Unattributable, contradictory, or inaccessible artifacts remain **Needs attention** evidence and do not change a lane.

Session evidence supplements, rather than replaces, host and repository facts:

- **OpenSpec change:** expected OpenSpec artifacts must exist. A linked session may show analysis, proposal drafting, or OpenSpec-file activity; such evidence explains the card but does not make a nonexistent repository change appear valid.
- **In progress:** a linked session can establish active implementation before a commit exists when its normalized evidence records implementation work—for example, a non-OpenSpec file write, an implementation/test command in the linked worktree, or an explicit provider phase marker. Git implementation-path changes remain equivalent evidence. Analysis or spec-only session activity does not qualify.
- **PR/MR:** an open, linked GitHub PR or GitLab MR is required. Session evidence can annotate that card but can never promote it into this lane, mark it ready, approve it, or report completion.

The host/repository precedence remains: an open linked non-draft PR/MR is **PR/MR**; otherwise a linked draft promotion with qualifying implementation Git *or session* evidence is **In progress**; otherwise a linked promotion with expected OpenSpec artifacts is **OpenSpec change**; otherwise it is **Idea**. A closed/merged item, missing linkage, or disagreement among signals is an exception, not a user-movable state.

The projection table:

| Column | Inclusion rule | Evidence shown |
| --- | --- | --- |
| **Idea** | An idea has no successful promotion to the selected repository, or its prior promotion was explicitly abandoned/closed under a future defined rule. | Source kind, permalink/manual label, snapshot time, saved/refresh state |
| **OpenSpec change** | A promotion branch and draft PR exist, the branch contains expected OpenSpec artifacts, and no qualifying implementation Git or session evidence exists. | Change path, branch, draft PR, OpenSpec artifact list, source snapshot, spec-session evidence when present |
| **In progress** | The linked draft PR has qualifying implementation evidence after promotion: non-OpenSpec implementation-path changes, a repository-native implementation marker, or attributed session evidence of active implementation. | Commits/changed paths and/or session provider, observed time, evidence type, artifact link, draft PR, linked OpenSpec change |
| **PR/MR** | A linked GitHub PR or GitLab MR is open and ready for review (not draft where that host supports drafts). Host state is authoritative; a closed or merged PR/MR is not presented as active work. | Host badge, PR/MR number/title, review state, checks summary if read, latest commit, optional session annotation |

This rule resolves the otherwise ambiguous locked sequence: **the initial promotion PR is draft**; it begins in “OpenSpec change,” moves to “In progress” when qualifying Git or session evidence appears, and enters “PR/MR” when a person or authorized automation changes the linked host item out of draft. Jumphour itself need not make that later ready-for-review transition.

Precedence is descending: an open linked non-draft PR/MR appears in **PR/MR** even if it also contains implementation evidence; an open draft promotion with qualifying implementation evidence appears in **In progress**; an open draft promotion containing only the change artifacts or spec-only session evidence appears in **OpenSpec change**; unpromoted work appears in **Idea**.

The UI must show the rule, last-heard time/interval, and facts that produced it. Cases that do not fit—missing branch, deleted PR/MR, renamed/moved change directory, multiple live host items for one promotion, inaccessible or unlinked session evidence, or a repository with nonstandard OpenSpec layout—belong in a “Needs attention” exception treatment rather than being silently placed in a normal column. Whether that is a fifth visible lane, a card badge/filter, or a separate health panel is an open design choice; it must not become a mutable status.

### 7.6 Repository linkage and discovery

The board needs stable linkage that survives a browser session:

- database records link idea snapshot → repository installation → branch → initial commit SHA → PR number/URL → expected OpenSpec change path;
- generated PR body and promotion commit include a recognizable Jumphour marker with the promotion identifier;
- status projection verifies the expected path/commit rather than depending solely on a branch-name convention; and
- launch records bind a single selected Idea or OpenSpec change to repository, intended CLI working directory, locked command, and stable session reference when available; and
- regular lane listeners reconcile current branch, PR/MR, and eligible session facts; lane-specific manual read triggers can request an immediate source/host read.

The data store accelerates lookup and protects the input snapshot; GitHub and the repository remain authoritative for code-bearing facts. If the database and Git disagree, the UI describes the mismatch and directs the user to the GitHub artifact.

### 7.7 Interface shape

The default screen is a compact workflow board with four fixed columns:

- cards lead with intent title and visible provenance;
- promotion state is clear before a user opens a detail view;
- every column header shows its regular interval and last-heard state; Idea has **Load ideas** and PR/MR has **Fetch PRs/MRs** without adding manual read triggers to the middle lanes;
- an eligible Idea detail leads with **Start spec with Claude Code**; an eligible OpenSpec change card/detail leads with **Start ship with Claude Code**. Each opens only one embedded, attended CLI session and visibly states the exact Interlock command and selected repository;
- cards in evidence-backed columns include direct branch/PR/MR links, any authorized session-evidence reference, and a short “why this column” statement;
- filtering is for repositories, inbox/source, and exceptions—not agile planning constructs;
- loading and source-authentication errors retain previous snapshots and explain what to do next;
- mobile is a readable column-by-column view, not a reduced Jira board; and
- a cat skin, if introduced, changes styling only.

The idea-detail view is the handoff surface: snapshot, permalink, later snapshots, human interpretation, existing promotions, target repository picker, primary in-app spec launch, and secondary non-agent Promote form. The linked PR/MR is the review surface; Jumphour links to it rather than reproducing host review.

## 8. Implied OpenSpec deltas

The following are the likely capability specifications to add when this epic becomes change proposals. They use OpenSpec’s behavioral framing—requirements and scenarios—not UI implementation tasks.

### Capability: `idea-intake`

**ADDED requirement: Import an idea through a configured MCP adapter.**

- Scenario: A user selects a GitLab/Jira/GitHub adapter and saves an accessible item. Jumphour stores a normalized snapshot, canonical permalink, adapter identity, and retrieval time, then shows it as an Idea.
- Scenario: The Idea lane's five-minute listener reads configured MCP inboxes and the manual inbox. The card/header shows when that lane last heard successfully or failed.
- Scenario: A user invokes **Load ideas** for selected GitHub, GitLab, Jira via MCP, or Manual inboxes. Jumphour performs an immediate read and does not mutate a source.
- Scenario: The adapter denies access or returns an error. Jumphour shows an actionable failure and preserves any prior snapshot.
- Scenario: A user refreshes an imported idea. Jumphour creates a new timestamped snapshot and does not rewrite the snapshot used by an existing promotion.

**ADDED requirement: Create a manual idea.**

- Scenario: A user provides the required manual fields. The item appears as a manually entered Idea with author/time attribution and no false external-source link.

### Capability: `source-provenance`

**ADDED requirement: Preserve source provenance separately from interpretation.**

- Scenario: A user opens a promoted idea. They can see its original permalink, selected snapshot time/hash, and later human-authored framing separately.
- Scenario: An imported issue contains instructions or dangerous markup. Jumphour treats it as untrusted content and does not turn it into an action or executable configuration.

**ADDED requirement: Never write to an intake source.**

- Scenario: A user imports, refreshes, promotes, or views a source issue. Jumphour does not add comments, labels, transitions, assignments, or other mutations to that source.

### Capability: `github-app-installation`

**ADDED requirement: Operate through a shareable GitHub App installation.**

- Scenario: An organization administrator installs the App for selected repositories. Authorized users can select only repositories exposed by that installation.
- Scenario: An installation lacks the required write/read permission. Jumphour prevents promotion and identifies the missing GitHub capability without attempting a partial write.

### Capability: `openspec-promotion`

**ADDED requirement: Optionally promote an idea into a GitHub-hosted OpenSpec change without an agent.**

- Scenario: A user chooses the lower-emphasis non-agent promotion form for a valid OpenSpec-enabled repository. Jumphour creates a branch from the default branch, commits expected OpenSpec files, and opens a draft PR linked to the selected snapshot.
- Scenario: A matching promotion already exists. Jumphour presents the existing branch/PR and does not create a duplicate by default.
- Scenario: Branch writing succeeds but PR creation is interrupted. Jumphour records/re-discovers the branch and permits an idempotent recovery to create the missing PR.
- Scenario: Repository OpenSpec conventions cannot be discovered or confirmed. Jumphour blocks promotion and explains what repository configuration is needed.

**ADDED requirement: Keep GitHub as the change plane.**

- Scenario: A promotion succeeds. The OpenSpec artifacts, commit, branch, and PR are available in GitHub without relying on the Jumphour UI.

### Capability: `attended-agent-launch`

**ADDED requirement: Start a narrowly bound, attended Interlock command in embedded Claude Code CLI.**

- Scenario: A user selects one eligible Idea and repository, passes CLI/Interlock/cwd preflight, and invokes **Start spec with Claude Code**. Jumphour opens Claude Code CLI inside Jumphour in that repository and runs exactly `interlock:spec`.
- Scenario: A user selects one eligible OpenSpec change and repository, passes the same preflight, and invokes **Start ship with Claude Code**. Jumphour opens Claude Code CLI inside Jumphour in that repository and runs exactly `interlock:ship`.
- Scenario: A user attempts a second launch while their Jumphour-launched embedded session is active. Jumphour links to the active session and blocks the new launch; it does not queue or schedule it.
- Scenario: Claude Code is unavailable, Interlock is missing the required command, or the detected CLI working directory differs from the selected repository. Jumphour blocks the command, explains the exact prerequisite or mismatch, and leaves the projected board state unchanged.

**ADDED requirement: Keep launch distinct from agent orchestration.**

- Scenario: Jumphour issues a locked command. Interlock, not Jumphour, governs its policy, execution, approval, and completion behavior.
- Scenario: A launched session emits no attributable logs or repository evidence. Jumphour does not move the card or claim completion.
- Scenario: An associated session ends, fails, or continues. Jumphour does not stop, reroute, babysit, approve, or schedule it; its ordinary listeners may only read eligible logs as evidence.

### Capability: `workflow-projection`

**ADDED requirement: Project fixed workflow columns from repository, host, and session evidence.**

- Scenario: An unpromoted snapshot appears in Idea.
- Scenario: A draft promotion PR with only expected OpenSpec artifacts or spec-only session evidence appears in OpenSpec change.
- Scenario: A draft linked PR gains implementation-path changes or qualifying, attributed active-implementation session evidence after promotion and appears in In progress.
- Scenario: The linked GitHub PR or GitLab MR becomes non-draft while open and appears in PR/MR.
- Scenario: A linked PR/MR closes, is merged, disappears, has ambiguous evidence, or has unlinked session activity. Jumphour surfaces a stated exception rather than allowing manual placement.

**ADDED requirement: Read associated agent-session evidence, including locked attended launches, without orchestrating agents.**

- Scenario: The OpenSpec change or In progress listener reads an authorized Cursor, Claude Code, or Interlock artifact—including a Jumphour-launched Claude Code session—that links stably to a promotion. The card shows provider, observed time, evidence type, and an authorized artifact reference.
- Scenario: An associated artifact records qualifying implementation work before a commit exists. The draft promotion appears in In progress with that reason.
- Scenario: An artifact is inaccessible, lacks stable linkage, or contains only analysis/spec work. It does not invent an implementation state; Jumphour retains the prior projection or surfaces Needs attention.

**ADDED requirement: Read PR/MR evidence on schedule and on request.**

- Scenario: The PR/MR lane listener polls linked GitHub PR and GitLab MR facts every five minutes and displays last-heard state.
- Scenario: A user invokes **Fetch PRs/MRs**. Jumphour makes an immediate GitHub/GitLab MCP read, links only deterministically matching records, and makes no host mutation.

**ADDED requirement: Explain every projected status.**

- Scenario: A user opens a card. Jumphour lists repository/host/session facts, source link, observed time, last-heard lane state, and precedence rule that put the card in its current column.

### Capability: `workflow-board`

**ADDED requirement: Present a fixed, source-aware board.**

- Scenario: A user filters to one accessible repository. They see only cards linked to it plus unpromoted ideas eligible for promotion.
- Scenario: GitHub, an MCP adapter, or a session-artifact provider is loading/fails. The UI separates stale observed state from unavailable current state, shows each lane's last-heard/automatic-retry state, and exposes only the defined Idea or PR/MR manual read when applicable.

## 9. Proposed upcoming change breakdown

These should be separate OpenSpec proposals because each has a distinct capability boundary, testable outcome, and risk. They are ordered by dependency, not by a claim that all must ship before learning.

### Change 1 — Establish the GitHub App and repository/OpenSpec discovery

**Outcome:** A team can install Jumphour for selected repositories, sign in, view accessible repositories, and receive a validated description of each repository’s default branch and supported OpenSpec layout.

**Likely artifacts:** `github-app-installation` and the discovery portion of `openspec-promotion`.

**Why separate:** It determines the permission model, tenancy boundary, and OpenSpec compatibility contract. Intake and promotion cannot safely build on guesses about repositories.

**Key decisions to lock:** App permissions, user authorization mapping, how repository OpenSpec configuration is found, and behavior for repositories that have not adopted OpenSpec.

### Change 2 — Add read-only MCP inboxes and immutable idea snapshots

**Outcome:** The Idea lane listens every five minutes, and users can invoke **Load ideas** to fetch GitHub Issues, GitLab issues, Jira via MCP, and manually entered ideas; saved items have attributable snapshots and source permalinks.

**Likely artifacts:** `idea-intake` and `source-provenance`.

**Why separate:** It creates the product’s distinct input boundary and validates adapter authentication, normalization, privacy, error handling, and snapshot semantics before any GitHub writes occur.

**Key decisions to lock:** adapter contract, snapshot retention/deletion policy, source content sanitization, five-minute listener retry/backoff behavior, Load ideas scope, explicit refresh behavior, and manual-idea schema.

### Change 3 — Add attended in-app Interlock launches

**Outcome:** A user selects exactly one Idea and accessible repository to open Claude Code CLI inside Jumphour and run `interlock:spec`, or selects exactly one OpenSpec change to run `interlock:ship`. The launch is attended, shows its repository/command binding, and produces only read-only session linkage for later listeners.

**Likely artifacts:** `attended-agent-launch`, plus session-linkage extensions to `workflow-projection`.

**Why separate:** It establishes the primary agent path while preserving Interlock’s governance boundary. It must make one-card binding, embedded CLI prerequisites, session exclusivity, and failure recovery explicit before the board presents launches as trustworthy.

**Key decisions to lock:** Claude Code embedding/session host, verification of installed Interlock commands, repository-to-cwd validation, active-session scope, stable session linkage, user-visible failure copy, and the exact eligible card conditions.

### Change 4 — Retain optional non-agent promotion into a conventional OpenSpec draft PR

**Outcome:** A user who deliberately chooses the non-agent fallback selects a snapshot and repository, reviews generated OpenSpec change content, and creates one idempotent branch/commit/draft PR with provenance.

**Likely artifacts:** `openspec-promotion`.

**Why separate:** Promote is retained because direct repository-native artifact creation is useful, but it must not compete with or obscure the primary Idea → `interlock:spec` path.

**Key decisions to lock:** initial files/templates, required promotion form fields, branch/commit/PR markers, duplicate policy, retry/recovery UX, non-OpenSpec repository policy, and its lower-emphasis placement relative to agent launch.

### Change 5 — Project the evidence-derived workflow board

**Outcome:** All four lanes expose their interval/last-heard state. Users see linked ideas and promotions in fixed Idea, OpenSpec change, In progress, and PR/MR columns, with session evidence in the middle lanes, MCP PR/MR reads in the final lane, an explanation of each placement, and an exception state for ambiguity.

**Likely artifacts:** `workflow-projection` and `workflow-board`.

**Why separate:** It turns the underlying relationships into the product’s primary UI. Derivation rules can be validated from real promotion records rather than imagined card data.

**Key decisions to lock:** normalized session-artifact access and linkage, exact implementation-evidence classification, GitLab MR linkage to GitHub-originated promotions, draft/non-draft host semantics, handling of closed/merged PRs/MRs, and visibility/retention of exceptions.

### Change 6 — Harden multi-team operation and observability

**Outcome:** Multiple App installations and adapters are isolated, permission changes fail safely, promotion reconciliation and per-lane listeners are observable, and operators can diagnose status, session-evidence, or connector failures.

**Likely artifacts:** extensions to all prior capabilities, especially authorization, data handling, and error requirements.

**Why separate:** Multi-tenant security and operational readiness should build on the validated minimum flow, but must precede a broad external App rollout.

**Explicitly defer from this breakdown:** webhooks, source write-back, two-way syncing, non-GitHub change planes, execution/approval/scheduling integrations beyond the two attended Interlock command launches, preview environments/databases, and an E2E test platform.

## 10. Risks, tradeoffs, and mitigations

| Risk | Why it matters | Initial mitigation |
| --- | --- | --- |
| Workflow columns become arbitrary in edge cases | A board that claims Git derivation but silently guesses loses trust. | Publish precedence rules, show evidence, and route ambiguous cases to an exception state. |
| “OpenSpec change” and “PR” appear contradictory because promotion opens a PR | A newly promoted PR could otherwise jump straight to the final column. | Require the promotion PR to start as draft; use draft + changed-path evidence to distinguish the middle states. |
| Repository OpenSpec layouts vary | Generating a generic layout can create unusable or misleading files. | Discover existing configuration/templates; block or explicitly support an initialization path later rather than guessing. |
| Source snapshot data is sensitive or stale | External issues may contain private customer, security, or business information, and can change after intake. | Apply workspace isolation, retention policy, least-privilege adapters, immutable timestamped snapshots, and clear stale/refresh display. |
| MCP adapter authentication is uneven | Jira/GitLab/GitHub adapters may have different installation, scopes, and availability. | Define a small normalized read contract; make source health visible; support fetch-on-demand; never make a source error look like a source deletion. |
| Polling causes unnecessary source load or stale expectations | Four lane listeners can be mistaken for real-time synchronization or exceed adapter limits. | Lock a five-minute default, show last-heard and failures, use bounded backoff, and keep manual reads scoped to their lane. |
| Session logs are ambiguous, sensitive, or unavailable | A raw transcript can leak data or make a speculative agent action look authoritative. | Accept only access-controlled normalized facts, require stable promotion linkage, minimize raw-log display, and route ambiguity to Needs attention. |
| Session evidence incorrectly advances work | Agent activity can be planning rather than implementation, especially before a commit exists. | Treat spec-only evidence as OpenSpec change; require a qualifying implementation event for In progress; never let a log create PR/MR state or completion. |
| GitLab MR facts do not map cleanly to GitHub promotions | The write plane is GitHub, while the final lane can read both hosts. | Make GitLab MRs read-only and require deterministic linkage; leave unlinked MRs as candidates/exceptions rather than inventing a relationship. |
| Imported content causes prompt injection or unsafe rendering | Issue bodies are untrusted remote text and may contain instructions or hostile links. | Sanitize markup, treat all imported content as data, isolate any AI-assisted drafting from tool authority, and require explicit user confirmation for promotion fields. |
| Promotion retries create duplicate branches and PRs | Network/API interruption is common around multi-step writes. | Use durable idempotency keys/markers, detect existing branch and commit, make PR creation recoverable, and show conflicts before writes. |
| The board shadows GitHub instead of projecting it | Cached data can become another stale tracker. | Reconcile repository/host facts on the regular listener, display last-heard and observed times, and make host links first-class. |
| GitHub App permissions are too broad | An installable App without a narrow scope will be hard to trust and adopt. | Start with selected repositories and the least permissions that support branch/file/PR operations; document each permission’s purpose. |
| PMs lack GitHub access or source access differs from repo access | A PM may be able to submit intent but not create a branch; an engineer may have the opposite access. | Separate view/import eligibility from promotion authority; fail clearly and avoid attempting to bridge permissions invisibly. |
| Scope drifts into a generic tracker | Users will ask for owners, dates, custom states, and sync once a board exists. | Make fixed columns and Git derivation core product constraints; defer all mutable planning primitives. |
| Scope drifts into the existing agent products | Agent activity is visible nearby, tempting Jumphour to run it. | Limit Jumphour to the two attended Interlock launch commands and read session artifacts otherwise; define execution policy, approval, and scheduling as explicit non-goals. |
| Embedded CLI grows into an agent control plane | A convenient terminal could turn Jumphour into an Interlock replacement. | Permit only user-triggered `interlock:spec` from one Idea and `interlock:ship` from one OpenSpec change; one active session per user/workspace, no queues, controls, approvals, or scheduling. |
| CLI prerequisites or cwd are invalid | A command in the wrong repository or without Interlock can produce misleading work. | Preflight Claude Code availability, command installation, repository/cwd identity, and active-session state; fail closed with a concrete recovery path and no board mutation. |
| Cats obscure the professional use case | A mascot-first surface may make provenance and state hard to scan. | Keep skins optional and ensure the default information architecture is work-focused. |

## 11. Open questions to resolve before proposals

These questions materially affect the requirements or technical design and should be answered before or within the named changes.

### Workflow semantics

1. The draft-PR interpretation is locked as the canonical meaning of **OpenSpec change → In progress → PR/MR**. What exact GitLab draft/ready-for-review API semantics and fields must the host adapter normalize?
2. The V1 polling default is locked at five minutes. Which operational limits require a different workspace-level allowed range, and what retry/backoff budget is acceptable per MCP adapter?
3. Which exact normalized Cursor, Claude Code, and Interlock artifact fields are available for repository, branch, expected change path, PR/MR, file activity, commands, and phase markers? A provider without stable linkage cannot advance a card. The Jumphour-launched Claude Code session must provide or be associated with this stable linkage.
4. What repository-specific paths/events count as qualifying implementation evidence beyond the locked baseline (non-OpenSpec file write or implementation/test command), and how can an administrator configure this without reintroducing mutable workflow?
5. Where do merged and closed PRs/MRs go? V1 can exclude them from the active board and retain them in a filter/history view, but it needs a durable retention rule.
6. Can one OpenSpec change legitimately have multiple implementation PRs/MRs? If so, what is the canonical card/host item, and how should related items be displayed without creating a mutable tracker?
7. What should happen if the OpenSpec change directory is renamed, archived, or deleted after promotion?

### OpenSpec authoring

8. Which OpenSpec profiles/layouts must V1 support, and is support limited initially to repositories that already contain `openspec/config.yaml` plus an established change layout?
9. For the optional non-agent Promote path, does it generate complete `proposal.md`, `design.md`, `tasks.md`, and delta specs, or only a high-quality proposal scaffold that an engineer/agent completes? Generating delta specs from a short issue can create false precision.
10. If AI drafting is included, what review/confirmation boundary prevents untrusted issue content from determining scope, repository, tool calls, or final specification claims?
11. Is a visible source-reference section in `proposal.md` the desired cross-tool provenance contract, and what minimum data is safe to commit for private versus public repositories?

### Identity, permissions, and tenancy

12. What authentication model joins a GitHub App user to an MCP adapter identity, particularly for Jira, GitLab, and session-artifact providers? Are adapters per-user, per-workspace service accounts, or both?
13. May a user save an imported source they can read but not promote it to a repository, and what collaboration/sharing behavior is expected in that case?
14. What data-retention, deletion, export, audit, and raw-transcript minimization policies apply to stored external issue snapshots and session evidence, especially under enterprise security requirements?
15. What exact GitHub App permissions are acceptable, and should promotion require an additional user confirmation immediately before the write?

### Product surface and rollout

16. What is the first supported GitHub App distribution model: a single organization, a limited set of external beta installations, or public installability?
17. Which MCP adapters are available and trusted in the deployed environment today for source reads, GitHub/GitLab PR/MR reads, and Cursor/Claude Code/Interlock session-artifact reads?
18. Is the locked five-minute polling interval acceptable for the intended team rhythm, or is there a specific low-complexity event trigger worth adding later (for example, GitHub App PR events only)?
19. What is the smallest set of accessibility, mobile, and localization requirements for an inbox/board that PMs and engineers will use frequently?

## 12. Recommended next move

Treat this brief as the exploration handoff and begin with the change proposal that establishes the GitHub App/repository discovery contract. In parallel, the next proposal can specify the read-only idea-snapshot model because it has no GitHub write path. Then specify the primary attended launch contract—Idea → `interlock:spec` and OpenSpec change → `interlock:ship`—before designing the optional non-agent Promote fallback or a polished board. Without an agreed OpenSpec layout, embedded CLI prerequisite/cwd contract, session-linkage model, promotion idempotency model, and status derivation contract, the UI would risk becoming precisely the manually maintained tracker this epic excludes.

The first proposals should carry forward the locked per-lane listen/trigger contract, five-minute default, primary agent-launch decision, and session-evidence boundary. They must resolve the exact artifact adapter fields, embedded-session linkage, and GitLab-MR linkage before relying on session evidence to advance a card. Once that is settled, the change files can use the capabilities and scenarios in this brief as their delta-spec starting point.
