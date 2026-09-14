# Jumphour

**Turns captured ideas into OpenSpec changes and reviewable GitHub PRs.**
For engineers, PMs, and agents who already use GitHub and OpenSpec.

```text
Idea → OpenSpec change → In progress → PR/MR
# Next: open docs/jumphour-epic-brief.md. No hosted app yet.
```

- **Frozen intake.** GitHub Issues, GitLab issues, and Jira through read-only adapters (MCP), or a manual compose. Jumphour never writes those sources.
- **Attended handoff.** One Idea runs `interlock:spec`. One OpenSpec change runs `interlock:ship`. Interlock still owns execution.
- **Evidence columns.** Placement is derived from repository, host, and session facts. Cards are not draggable statuses.

## Install

There is no package, binary, or hosted URL. This repository is planning-stage: a README, the epic, and OpenSpec change folders. It does not ship an app you can open.

Clone the working tree you already have. There is no public git remote in this checkout.

What you will find:

- Product decisions in the [epic brief](docs/jumphour-epic-brief.md)
- Board screens and states in the [Claude design prompt](docs/jumphour-claude-design-prompt.md)
- Specified work in [Change 1](openspec/changes/github-app-and-openspec-discovery/proposal.md) (GitHub App and OpenSpec discovery) and [Change 2](openspec/changes/mcp-inboxes-and-idea-snapshots/proposal.md) (MCP inboxes and idea snapshots)

V1, once implemented, needs a GitHub organization that can install a **private** GitHub App.
Claude Code and Interlock are required for the two attended launches.
Stack versions are not pinned. Change 1 task 1.1 records them at apply time.
See the [epic](docs/jumphour-epic-brief.md) for the full constraint table.

## How it works

The default screen is a four-column board. Columns are a view, not a workflow engine. Every lane listens every five minutes. Launches are user-triggered, one card at a time.

| Screen | What you see | What you can do |
| --- | --- | --- |
| Idea | Frozen snapshots from MCP inboxes or a manual compose | **Load ideas**. **Start spec with Claude Code** (`interlock:spec`) |
| OpenSpec change | Branch plus expected OpenSpec artifacts | **Start ship with Claude Code** (`interlock:ship`) |
| In progress | Implementation evidence on a draft promotion | Listen only in V1 |
| PR/MR | Linked GitHub PR or GitLab MR, ready for review | **Fetch PRs/MRs** (read only) |

Optional **Promote** creates OpenSpec files on a GitHub branch and a draft PR without an agent.
It is secondary to the attended spec launch.
GitHub is the write change plane.
Intake sources and GitLab MRs stay read-only.

## Why this

- **Not a Jira clone.** No sprints, estimates, assignees-as-workflow, or drag-and-drop status. Locked in the [epic non-goals](docs/jumphour-epic-brief.md).
- **Snapshot plus permalink.** A URL is not evidence. Refresh appends a new snapshot; it does not overwrite the one used for promotion.
- **Interlock still governs agents.** Jumphour opens Claude Code for two commands. It does not schedule, approve, or babysit the session.
- **GitHub App, not a personal token.** Specified in [Change 1](openspec/changes/github-app-and-openspec-discovery/proposal.md). Installations isolate tenants.
- **Complementary loop.** Checkpoint stays phone approval. Escapement stays unattended scheduling. Jumphour is the idea-to-spec board in front.

## How it compares

[Plane](https://github.com/makeplane/plane) is a general project-management app (cycles, modules, roadmaps). Jumphour refuses that surface: four derived columns, no planning primitives.

[OpenSpec](https://github.com/Fission-AI/OpenSpec) is the repository spec layer Jumphour writes toward. It is not a team intake board. Jumphour consumes ordinary OpenSpec change folders; it does not replace the CLI or slash commands.

[Spec Kit](https://github.com/github/spec-kit) is an in-repo spec-driven agent toolkit. Jumphour is the GitHub-native board in front of OpenSpec and Interlock: frozen intake, attended `interlock:spec` / `interlock:ship`, optional Promote.

## Status

Planning. No application code, no GitHub App registration in this repo, no test command.

In-flight OpenSpec changes (tasks unchecked):

- [github-app-and-openspec-discovery](openspec/changes/github-app-and-openspec-discovery/proposal.md) — private GitHub App, sign-in, OpenSpec discovery
- [mcp-inboxes-and-idea-snapshots](openspec/changes/mcp-inboxes-and-idea-snapshots/proposal.md) — read-only MCP inboxes and immutable snapshots

Still epic-only (no change folder yet): attended Interlock launches, optional Promote, evidence-derived board, multi-team hardening.

## Docs

| Doc | What it is |
| --- | --- |
| [Epic brief](docs/jumphour-epic-brief.md) | Locked product direction, users, non-goals, six proposed changes |
| [Claude design prompt](docs/jumphour-claude-design-prompt.md) | Board prototype prompt (not a running UI) |
| [Change 1 proposal](openspec/changes/github-app-and-openspec-discovery/proposal.md) | GitHub App and OpenSpec discovery |
| [Change 1 design](openspec/changes/github-app-and-openspec-discovery/design.md) | Tenancy, permissions, classifier |
| [Change 2 proposal](openspec/changes/mcp-inboxes-and-idea-snapshots/proposal.md) | MCP inboxes and snapshots |
| [Change 2 design](openspec/changes/mcp-inboxes-and-idea-snapshots/design.md) | Adapter port, hash, listener |

## Development

Greenfield. There is no dev server and no project test command.

Implementation starts at Change 1 task 1.1: pin the web runtime, GitHub client, YAML parser, and SQL store, then scaffold. Do not assume a stack; `openspec/config.yaml` does not lock one.

## License

No license file is in the repository yet.
