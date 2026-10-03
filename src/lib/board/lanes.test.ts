import { describe, expect, it } from "vitest";
import { LANE_IDS, LANES } from "./lanes";

describe("LANE_IDS", () => {
  it("lists the four lanes in fixed board order", () => {
    expect(LANE_IDS).toEqual(["idea", "openspec-change", "in-progress", "pr-mr"]);
  });

  it("has exactly one LANES entry per lane id", () => {
    expect(Object.keys(LANES).sort()).toEqual([...LANE_IDS].sort());
  });
});

describe("LANES", () => {
  it("titles the lanes Idea, OpenSpec change, In progress, PR/MR in order", () => {
    expect(LANE_IDS.map((id) => LANES[id].title)).toEqual(["Idea", "OpenSpec change", "In progress", "PR/MR"]);
  });

  it("carries the four sublabels verbatim, in order", () => {
    expect(LANE_IDS.map((id) => LANES[id].sublabel)).toEqual([
      "Captured, not yet promoted",
      "Branch and change artifacts exist",
      "Implementation evidence is active",
      "Host review is open or ready",
    ]);
  });

  it("carries the prototype's loading labels", () => {
    expect(LANE_IDS.map((id) => LANES[id].loadingLabel)).toEqual([
      "Reading GitHub Issues, GitLab, Jira via MCP…",
      "Reconciling OpenSpec artifacts…",
      "Reconciling commits and session evidence…",
      "Fetching PRs and MRs via MCP…",
    ]);
  });

  it("gives every lane a non-empty legend rule", () => {
    for (const id of LANE_IDS) expect(LANES[id].legendRule.trim()).not.toBe("");
  });
});
