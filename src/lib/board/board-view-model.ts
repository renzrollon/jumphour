// The board's only input: a plain-JSON view model (design.md Decision 1).
// ISO-8601 strings, no Date, no functions, no class instances — it crosses the
// server→client boundary as a prop. Names are binding (shared brief,
// "View-model contract"). This module imports nothing from React, Next.js, or
// src/server/.

// Lane identity. `LANE_IDS` (the ordered tuple and its copy) lives in
// `lanes.ts`; this union is its element type and must stay in the same order:
// idea, openspec-change, in-progress, pr-mr.
export type LaneId = "idea" | "openspec-change" | "in-progress" | "pr-mr";

// Same canonical vocabulary as mcp-inboxes-and-idea-snapshots `source_kind`.
export type SourceKind = "github-issue" | "gitlab-issue" | "jira" | "manual";

export type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

export type ListenerState =
  | { status: "not-configured" }
  | { status: "never-heard"; intervalMinutes: number }
  | { status: "healthy"; intervalMinutes: number; lastHeardAt: string }
  | { status: "delayed"; intervalMinutes: number; lastSuccessAt: string | null; retrying: boolean };

export type Availability = { status: "available" } | { status: "unavailable"; reason: string };

/** Canonical repository identity is `githubRepoId`; `fullName` is display only. */
export interface RepositoryRef {
  githubRepoId: number;
  fullName: string;
}

export interface CardViewModel {
  id: string;
  /** Derived by the provider, never by the UI. */
  laneId: LaneId;
  /** `key` e.g. "#814", "PAY-184", "PR #482"; null for manual. */
  source: { kind: SourceKind; key: string | null };
  title: string;
  changeName: string | null;
  repository: RepositoryRef | null;
  owner: { displayName: string } | null;
  relevance: string | null;
  /** `at` is an ISO-8601 instant. */
  freshness: { kind: "snapshot" | "fetched" | "composed"; at: string };
  evidence: { tone: Tone; text: string };
  agentNote: string | null;
  footer: string;
  /** e.g. "github.com"; a label only, never a link. */
  externalHostLabel: string | null;
}

export type ManualReadKind = "load-ideas" | "fetch-pull-requests";

export interface ManualRead {
  kind: ManualReadKind;
  availability: Availability;
  options: { id: string; label: string; badge: "github" | "gitlab" | "jira" | "manual"; viaMcp: boolean }[];
}

/** `manualRead` is non-null only on `idea` (`load-ideas`) and `pr-mr` (`fetch-pull-requests`). */
export interface LaneViewModel {
  id: LaneId;
  listener: ListenerState;
  manualRead: ManualRead | null;
  cards: CardViewModel[];
}

export interface BoardViewModel {
  /** ISO-8601 instant; every relative time on the board is computed against it. */
  generatedAt: string;
  installation: { installationId: number; accountLogin: string } | null;
  repositories: RepositoryRef[];
  /** Always four, in `LANE_IDS` order. */
  lanes: readonly [LaneViewModel, LaneViewModel, LaneViewModel, LaneViewModel];
  compose: Availability;
}
