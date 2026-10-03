// workflow-board-ui task 7.1 (design.md Decision 10; specs/ui-preview-gallery
// /spec.md "Reproduce the designed board scenarios by name"): the Claude
// Design prototype's 13 sample cards (`Jumphour Board prototype review/
// Jumphour Board.dc.html`, lines 661–675), transcribed to `CardViewModel`.
// Fixture-only: nothing outside src/app/dev/ui/ may import this module
// (fixtures-isolation.test.ts), and its sample names — `Priya Nair`, the
// `acme/` repositories — appear nowhere in production code
// (src/fixture-strings.test.ts).
//
// Transcription rules, applied uniformly:
//   - lane: `idea` → "idea", `change` → "openspec-change", `progress` →
//     "in-progress", `pr` → "pr-mr".
//   - source: GitHub → "github-issue", GitLab → "gitlab-issue", Jira →
//     "jira", Manual → "manual"; an empty key becomes `null`.
//   - repository: the prototype's `repo` string, with a stable fixture
//     `githubRepoId` per repository (the canonical identity; `fullName` is
//     display only).
//   - owner: "Unassigned" becomes `null` (the card shows no owner, and no
//     "Unassigned" text); relevance "" becomes `null`.
//   - freshness: the prototype's "Snapshot 14 min ago" / "Fetched …" /
//     "Composed …" becomes a kind plus an ISO instant offset from the fixed
//     BOARD_FIXTURE_GENERATED_AT, so the same relative text reproduces
//     deterministically.
//   - evidence: `dot` becomes the tone, `evidence` the text, verbatim.
//   - externalHostLabel: the prototype's `link` ("github.com", "Jira",
//     "gitlab.com"), or `null` where it is empty.
// Detail-panel fields (description, acceptance, labels, timeline) belong to a
// later change and are not transcribed.
import type {
  BoardViewModel,
  CardViewModel,
  LaneId,
  LaneViewModel,
  ListenerState,
  ManualRead,
  RepositoryRef,
  SourceKind,
  Tone,
} from "../../../../lib/board/board-view-model";
import { NO_FILTERS, type BoardFilters } from "../../../../lib/board/filter-cards";
import { LANE_IDS } from "../../../../lib/board/lanes";
import { PREVIEW_WORKSPACE } from "./shell";

/** The fixed instant every fixture relative time is measured against. */
export const BOARD_FIXTURE_GENERATED_AT = "2026-09-15T09:30:00.000Z";

export const BOARD_FIXTURE_REPOSITORIES: readonly RepositoryRef[] = [
  { githubRepoId: 910001, fullName: "acme/api-gateway" },
  { githubRepoId: 910002, fullName: "acme/customer-web" },
  { githubRepoId: 910003, fullName: "acme/mobile-shell" },
];

type FixtureRepository = "acme/api-gateway" | "acme/customer-web" | "acme/mobile-shell";

function repository(fullName: FixtureRepository): RepositoryRef {
  const found = BOARD_FIXTURE_REPOSITORIES.find((repo) => repo.fullName === fullName);
  if (!found) throw new Error(`Unknown fixture repository ${fullName}`);
  return { ...found };
}

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/** The ISO instant `minutes` before BOARD_FIXTURE_GENERATED_AT. */
function minutesAgo(minutes: number): string {
  return new Date(Date.parse(BOARD_FIXTURE_GENERATED_AT) - minutes * MINUTE_MS).toISOString();
}

interface PrototypeCard {
  id: string;
  laneId: LaneId;
  source: SourceKind;
  key: string;
  title: string;
  repo: FixtureRepository;
  owner: string;
  relevance: string;
  freshness: CardViewModel["freshness"]["kind"];
  /** Minutes before BOARD_FIXTURE_GENERATED_AT. */
  ageMinutes: number;
  evidence: string;
  dot: Tone;
  footer: string;
  link: string;
  changeName?: string;
  agentNote?: string;
}

function transcribe(card: PrototypeCard): CardViewModel {
  return {
    id: card.id,
    laneId: card.laneId,
    source: { kind: card.source, key: card.key === "" ? null : card.key },
    title: card.title,
    changeName: card.changeName ?? null,
    repository: repository(card.repo),
    owner: card.owner === "Unassigned" ? null : { displayName: card.owner },
    relevance: card.relevance === "" ? null : card.relevance,
    freshness: { kind: card.freshness, at: minutesAgo(card.ageMinutes) },
    evidence: { tone: card.dot, text: card.evidence },
    agentNote: card.agentNote ?? null,
    footer: card.footer,
    externalHostLabel: card.link === "" ? null : card.link,
  };
}

/** Prototype lines 661–675, field for field (detail-panel fields omitted). */
const PROTOTYPE_CARDS: readonly PrototypeCard[] = [
  {
    id: "c1",
    laneId: "idea",
    source: "github-issue",
    key: "#814",
    title: "Support request-level idempotency keys",
    repo: "acme/api-gateway",
    owner: "Priya Nair",
    relevance: "Platform reliability",
    freshness: "snapshot",
    ageMinutes: 14,
    evidence: "Captured from GitHub #814",
    dot: "neutral",
    footer: "Opened Sep 9 · updated Sep 14",
    link: "github.com",
  },
  {
    id: "c2",
    laneId: "idea",
    source: "jira",
    key: "PAY-184",
    title: "Give finance export failures an actionable retry path",
    repo: "acme/customer-web",
    owner: "Unassigned",
    relevance: "Finance ops",
    freshness: "snapshot",
    ageMinutes: 41,
    evidence: "Captured from Jira PAY-184 via MCP",
    dot: "neutral",
    footer: "Created Sep 3 · updated Sep 12",
    link: "Jira",
  },
  {
    id: "c3",
    laneId: "idea",
    source: "gitlab-issue",
    key: "#227",
    title: "Expose tenant-level webhook delivery metrics",
    repo: "acme/api-gateway",
    owner: "Tomasz Wolny",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: HOUR_MINUTES,
    evidence: "Captured from GitLab #227",
    dot: "neutral",
    footer: "Opened Aug 28 · updated Sep 11",
    link: "gitlab.com",
  },
  {
    id: "c4",
    laneId: "idea",
    source: "manual",
    key: "",
    title: "Compare hosted runners against the overnight queue",
    repo: "acme/mobile-shell",
    owner: "Dana Okafor",
    relevance: "CI cost",
    freshness: "composed",
    ageMinutes: 2 * DAY_MINUTES,
    evidence: "Created in Jumphour",
    dot: "neutral",
    footer: "Composed Sep 13",
    link: "",
    agentNote: "Drafted with agent assistance",
  },
  {
    id: "c5",
    laneId: "openspec-change",
    source: "github-issue",
    key: "#806",
    title: "Add idempotency keys to payment intents",
    repo: "acme/api-gateway",
    owner: "Priya Nair",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: 9,
    evidence: "Change: add-idempotency-keys · Claude Code · proposal drafting · observed 11 min ago",
    dot: "accent",
    footer: "Branch spec/add-idempotency-keys",
    link: "github.com",
    changeName: "add-idempotency-keys",
  },
  {
    id: "c6",
    laneId: "openspec-change",
    source: "jira",
    key: "PAY-201",
    title: "Rate-limit bulk invoice regeneration",
    repo: "acme/customer-web",
    owner: "Mei Lin",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: 41,
    evidence: "Change: rate-limit-invoice-regeneration · Needs attention · session not linked",
    dot: "warn",
    footer: "Branch spec/rate-limit-invoice-regeneration",
    link: "Jira",
    changeName: "rate-limit-invoice-regeneration",
  },
  {
    id: "c7",
    laneId: "openspec-change",
    source: "manual",
    key: "",
    title: "Consolidate feature flag SDK initialization",
    repo: "acme/mobile-shell",
    owner: "Dana Okafor",
    relevance: "",
    freshness: "composed",
    ageMinutes: 5 * DAY_MINUTES,
    evidence: "Change: consolidate-flag-init · Interlock artifact · proposal.md, tasks.md · observed 2 h ago",
    dot: "ok",
    footer: "Branch spec/consolidate-flag-init",
    link: "",
    changeName: "consolidate-flag-init",
  },
  {
    id: "c8",
    laneId: "in-progress",
    source: "github-issue",
    key: "#802",
    title: "Stream audit log exports instead of buffering",
    repo: "acme/api-gateway",
    owner: "Tomasz Wolny",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: 12,
    evidence: "Cursor session · implementation file activity · observed 3 min ago",
    dot: "accent",
    footer: "Branch feat/stream-audit-exports · 6 commits",
    link: "github.com",
  },
  {
    id: "c9",
    laneId: "in-progress",
    source: "jira",
    key: "MOB-77",
    title: "Offline queue for shell telemetry",
    repo: "acme/mobile-shell",
    owner: "Mei Lin",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: 41,
    evidence: "Claude Code · interlock:ship launched in acme/mobile-shell · session active",
    dot: "accent",
    footer: "Branch feat/offline-telemetry-queue",
    link: "Jira",
  },
  {
    id: "c10",
    laneId: "in-progress",
    source: "gitlab-issue",
    key: "#219",
    title: "Per-tenant rate limit headers",
    repo: "acme/api-gateway",
    owner: "Unassigned",
    relevance: "",
    freshness: "snapshot",
    ageMinutes: HOUR_MINUTES,
    evidence: "No session evidence observed yet · 3 commits on feat/tenant-rate-headers",
    dot: "neutral",
    footer: "Branch feat/tenant-rate-headers",
    link: "gitlab.com",
  },
  {
    id: "c11",
    laneId: "pr-mr",
    source: "github-issue",
    key: "PR #482",
    title: "Add retryable finance exports",
    repo: "acme/customer-web",
    owner: "Mei Lin",
    relevance: "",
    freshness: "fetched",
    ageMinutes: 14,
    evidence: "GitHub PR #482 · review requested",
    dot: "ok",
    footer: "Opened Sep 12 · 2 reviewers",
    link: "github.com",
  },
  {
    id: "c12",
    laneId: "pr-mr",
    source: "gitlab-issue",
    key: "MR !91",
    title: "Add tenant delivery metrics",
    repo: "acme/api-gateway",
    owner: "Tomasz Wolny",
    relevance: "",
    freshness: "fetched",
    ageMinutes: 14,
    evidence: "GitLab MR !91 · ready for review",
    dot: "ok",
    footer: "Opened Sep 11 · pipeline passed",
    link: "gitlab.com",
  },
  {
    id: "c13",
    laneId: "pr-mr",
    source: "github-issue",
    key: "PR #476",
    title: "Harden shell deep-link parsing",
    repo: "acme/mobile-shell",
    owner: "Dana Okafor",
    relevance: "",
    freshness: "fetched",
    ageMinutes: 14,
    evidence: "GitHub PR #476 · changes requested",
    dot: "warn",
    footer: "Opened Sep 8 · 1 reviewer",
    link: "github.com",
  },
];

/** The prototype's 13 cards, in prototype order: 4 Idea, 3 OpenSpec change, 3 In progress, 3 PR/MR. */
export const BOARD_FIXTURE_CARDS: readonly CardViewModel[] = PROTOTYPE_CARDS.map(transcribe);

/** The fixture cards the provider would derive into `laneId`, in prototype order. */
export function fixtureCardsInLane(laneId: LaneId): CardViewModel[] {
  return BOARD_FIXTURE_CARDS.filter((card) => card.laneId === laneId);
}

// workflow-board-ui task 7.2 (design.md Decision 10; specs/ui-preview-gallery
// /spec.md "Reproduce the designed board scenarios by name"): the prototype's
// six board scenarios (its `boardState` enum) as fixture `BoardViewModel`s,
// with the listener effects of prototype lines 752–757.
//
// Listener mapping, applied to every scenario unless it overrides a lane:
//   - Idea "Last heard 2 min ago", OpenSpec change "Last heard 4 min ago",
//     In progress "Last heard 1 min ago": healthy, every 5 min (the interval
//     the card timelines quote).
//   - PR/MR "Last successful listen 14 min ago", uncoloured in the prototype:
//     healthy, last heard 14 min ago. The model's "Last successful listen"
//     wording belongs to a delayed listener, and this lane is not delayed.
// Overrides:
//   - `source-error` (GitHub unreachable; "Last successful snapshot 48 min
//     ago"): In progress delayed and retrying ("Listening delayed ·
//     retrying"); PR/MR delayed but not retrying, last success 48 min ago.
//     The prototype shows the PR/MR line only in amber; here it also says
//     "Listening delayed", because state is never carried by color alone.
//   - `jira-failed` (Jira via MCP unavailable): the Idea lane is delayed and
//     retrying; its last successful listen stays 2 min ago, as the
//     prototype's "Last heard 2 min ago · Jira delayed" keeps it.
// Manual reads and Compose idea are available here, with the prototype's
// menu rows, so the preview can exercise its simulated read. The source
// banner and panel for the degraded scenarios arrive with a later change.

/** The prototype's board scenarios, in its `boardState` order. */
export const BOARD_SCENARIOS = [
  "populated",
  "loading",
  "empty",
  "filtered-empty",
  "source-error",
  "jira-failed",
] as const;

export type BoardScenarioName = (typeof BOARD_SCENARIOS)[number];

export const DEFAULT_BOARD_SCENARIO: BoardScenarioName = "populated";

/**
 * The scenario `raw` names, matched after trimming and lowercasing; anything
 * else — absent, empty, or unrecognized — is `populated`. For a repeated
 * search parameter the first value counts.
 */
export function parseScenario(raw: string | readonly string[] | null | undefined): BoardScenarioName {
  const value = typeof raw === "string" ? raw : raw?.[0];
  const name = value?.trim().toLowerCase();
  return BOARD_SCENARIOS.find((scenario) => scenario === name) ?? DEFAULT_BOARD_SCENARIO;
}

export interface BoardScenario {
  name: BoardScenarioName;
  view: BoardViewModel;
  /** The board is mid-read: lanes show placeholders under their real headers. */
  pending: boolean;
  /** The filters the board opens with; `NO_FILTERS` except for `filtered-empty`. */
  filters: BoardFilters;
}

const LISTENER_INTERVAL_MINUTES = 5;

function healthy(lastHeardMinutesAgo: number): ListenerState {
  return { status: "healthy", intervalMinutes: LISTENER_INTERVAL_MINUTES, lastHeardAt: minutesAgo(lastHeardMinutesAgo) };
}

function delayed(lastSuccessMinutesAgo: number, retrying = false): ListenerState {
  return {
    status: "delayed",
    intervalMinutes: LISTENER_INTERVAL_MINUTES,
    lastSuccessAt: minutesAgo(lastSuccessMinutesAgo),
    retrying,
  };
}

function delayedRetrying(lastSuccessMinutesAgo: number): ListenerState {
  return delayed(lastSuccessMinutesAgo, true);
}

function noFilters(): BoardFilters {
  return { ...NO_FILTERS };
}

const POPULATED_LISTENERS: Readonly<Record<LaneId, ListenerState>> = {
  idea: healthy(2),
  "openspec-change": healthy(4),
  "in-progress": healthy(1),
  "pr-mr": healthy(14),
};

/** Prototype lines 110–115 (Load ideas) and 184–187 (Fetch PRs/MRs). */
const LOAD_IDEAS: ManualRead = {
  kind: "load-ideas",
  availability: { status: "available" },
  options: [
    { id: "github", label: "GitHub Issues", badge: "github", viaMcp: true },
    { id: "gitlab", label: "GitLab issues", badge: "gitlab", viaMcp: true },
    { id: "jira", label: "Jira", badge: "jira", viaMcp: true },
    { id: "manual", label: "Manual inbox", badge: "manual", viaMcp: false },
  ],
};

const FETCH_PULL_REQUESTS: ManualRead = {
  kind: "fetch-pull-requests",
  availability: { status: "available" },
  options: [
    { id: "github", label: "GitHub pull requests", badge: "github", viaMcp: false },
    { id: "gitlab", label: "GitLab merge requests", badge: "gitlab", viaMcp: false },
  ],
};

const MANUAL_READS: Readonly<Record<LaneId, ManualRead | null>> = {
  idea: LOAD_IDEAS,
  "openspec-change": null,
  "in-progress": null,
  "pr-mr": FETCH_PULL_REQUESTS,
};

/** A deep copy, so no two views share a mutable object. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtureView(cards: readonly CardViewModel[], listeners: Partial<Record<LaneId, ListenerState>> = {}): BoardViewModel {
  const lane = (id: LaneId): LaneViewModel => ({
    id,
    listener: copy(listeners[id] ?? POPULATED_LISTENERS[id]),
    manualRead: copy(MANUAL_READS[id]),
    cards: copy(cards.filter((card) => card.laneId === id)),
  });
  const [idea, change, progress, prMr] = LANE_IDS;
  return {
    generatedAt: BOARD_FIXTURE_GENERATED_AT,
    installation: copy(PREVIEW_INSTALLATION),
    repositories: copy([...BOARD_FIXTURE_REPOSITORIES]),
    lanes: [lane(idea), lane(change), lane(progress), lane(prMr)],
    compose: { status: "available" },
  };
}

/** The preview shell's fixture workspace, as the board's installation. */
const PREVIEW_INSTALLATION: BoardViewModel["installation"] =
  PREVIEW_WORKSPACE.current === null
    ? null
    : { installationId: PREVIEW_WORKSPACE.current.installationId, accountLogin: PREVIEW_WORKSPACE.current.accountLogin };

const MOBILE_SHELL_REPO_ID = repository("acme/mobile-shell").githubRepoId;

/** The fixture `BoardScenario` for `name`, built fresh on every call. */
export function boardScenario(name: BoardScenarioName): BoardScenario {
  switch (name) {
    case "populated":
      return { name, view: fixtureView(BOARD_FIXTURE_CARDS), pending: false, filters: noFilters() };
    case "loading":
      // The prototype's `loading` is its mid-read state (`startLoading`):
      // real lane headers over labelled placeholders.
      return { name, view: fixtureView(BOARD_FIXTURE_CARDS), pending: true, filters: noFilters() };
    case "empty":
      return { name, view: fixtureView([]), pending: false, filters: noFilters() };
    case "filtered-empty":
      // The prototype opens narrowed to Jira in acme/mobile-shell, which leaves
      // only MOB-77 (In progress) visible. The view keeps every card and the
      // board opens with those two filters set, so the Idea lane reads "No
      // Jira ideas match this repository" and Reset filters restores the rest.
      return {
        name,
        view: fixtureView(BOARD_FIXTURE_CARDS),
        pending: false,
        filters: { ...noFilters(), source: "jira", repositoryId: MOBILE_SHELL_REPO_ID },
      };
    case "source-error":
      return {
        name,
        view: fixtureView(BOARD_FIXTURE_CARDS, { "in-progress": delayedRetrying(48), "pr-mr": delayed(48) }),
        pending: false,
        filters: noFilters(),
      };
    case "jira-failed":
      return { name, view: fixtureView(BOARD_FIXTURE_CARDS, { idea: delayedRetrying(2) }), pending: false, filters: noFilters() };
    default:
      return assertNever(name);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown board scenario: ${String(value)}`);
}
