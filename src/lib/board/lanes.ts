// Lane identity and copy (design.md Decision 4, "Lane identity and copy").
// The one place lane order and lane wording live; lane headers, the
// small-screen lane selector, the legend popover, empty-state copy, loading
// labels, and the preview page all read from here. Copy is transcribed from
// the prototype (`Jumphour Board.dc.html` lines 97–100 and 678–681).
import type { LaneId } from "./board-view-model";

/** The four lanes in fixed board order. */
export const LANE_IDS = ["idea", "openspec-change", "in-progress", "pr-mr"] as const satisfies readonly LaneId[];

// Compile-time guard: every `LaneId` appears in `LANE_IDS`.
type MissingLaneId = Exclude<LaneId, (typeof LANE_IDS)[number]>;
const everyLaneListed: [MissingLaneId] extends [never] ? true : never = true;
void everyLaneListed;

export interface LaneCopy {
  /** Lane header title. */
  title: string;
  /** Derived-evidence sublabel under the title. */
  sublabel: string;
  /** Shown over the lane's skeleton while the board loads. */
  loadingLabel: string;
  /** Legend text after "<title> — ": the evidence that places a card here (prototype wording, lowercase start). */
  legendRule: string;
}

export const LANES: Readonly<Record<LaneId, Readonly<LaneCopy>>> = {
  idea: {
    title: "Idea",
    sublabel: "Captured, not yet promoted",
    loadingLabel: "Reading GitHub Issues, GitLab, Jira via MCP…",
    legendRule: "a captured snapshot from GitHub, GitLab, Jira via MCP, or composed here.",
  },
  "openspec-change": {
    title: "OpenSpec change",
    sublabel: "Branch and change artifacts exist",
    loadingLabel: "Reconciling OpenSpec artifacts…",
    legendRule: "a branch with openspec/changes/… artifacts exists.",
  },
  "in-progress": {
    title: "In progress",
    sublabel: "Implementation evidence is active",
    loadingLabel: "Reconciling commits and session evidence…",
    legendRule: "commits or linked session evidence show implementation work.",
  },
  "pr-mr": {
    title: "PR/MR",
    sublabel: "Host review is open or ready",
    loadingLabel: "Fetching PRs and MRs via MCP…",
    legendRule: "a pull or merge request is open on the host.",
  },
};
