// Task 3.6 (specs/workflow-board/spec.md "Distinguish first-use, not-enabled,
// filtered-empty, and loading states"): a lane emptied by filters names what
// did not match and offers "Reset filters" (plus "Compose idea" on the Idea
// lane only); a lane with nothing derived into it says so and offers nothing.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Availability, LaneId } from "../../../lib/board/board-view-model";
import { NO_FILTERS, type BoardFilters } from "../../../lib/board/filter-cards";
import { LaneEmpty, laneEmptyText } from "./lane-empty";

const LANE_IDS: readonly LaneId[] = ["idea", "openspec-change", "in-progress", "pr-mr"];
const AVAILABLE: Availability = { status: "available" };
const UNAVAILABLE: Availability = { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." };

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const filters = (patch: Partial<BoardFilters>): BoardFilters => ({ ...NO_FILTERS, ...patch });

const ACTIVE: ReadonlyArray<[string, BoardFilters]> = [
  ["a query", filters({ query: "idempotency" })],
  ["a repository", filters({ repositoryId: 701 })],
  ["a source", filters({ source: "jira" })],
  ["an owner", filters({ owner: "Priya Nair" })],
];

const render = (laneId: LaneId, f: BoardFilters, compose: Availability = AVAILABLE) =>
  renderToStaticMarkup(<LaneEmpty laneId={laneId} filters={f} compose={compose} />);

describe("laneEmptyText", () => {
  it("names the source and the repository on a filtered Idea lane", () => {
    expect(laneEmptyText("idea", filters({ source: "jira", repositoryId: 701 }))).toBe("No Jira ideas match this repository");
    expect(laneEmptyText("idea", filters({ source: "github-issue" }))).toBe("No GitHub ideas match these filters");
    expect(laneEmptyText("idea", filters({ query: "nope" }))).toBe("No ideas match these filters");
    expect(laneEmptyText("idea", filters({ repositoryId: 701 }))).toBe("No ideas match this repository");
  });

  it("names the lane on every other filtered lane", () => {
    expect(laneEmptyText("in-progress", filters({ query: "nope" }))).toBe("No in progress items match these filters");
    expect(laneEmptyText("openspec-change", filters({ query: "nope" }))).toBe("No OpenSpec change items match these filters");
    expect(laneEmptyText("pr-mr", filters({ source: "jira", repositoryId: 701 }))).toBe("No PR/MR items match these filters");
  });

  it("says nothing was derived when no filter is active", () => {
    expect(laneEmptyText("pr-mr", NO_FILTERS)).toBe("Nothing derived into PR/MR yet");
    expect(laneEmptyText("in-progress", NO_FILTERS)).toBe("Nothing derived into In progress yet");
  });

  it("treats a whitespace-only query as no filter", () => {
    expect(laneEmptyText("pr-mr", filters({ query: "   " }))).toBe("Nothing derived into PR/MR yet");
    expect(laneEmptyText("idea", filters({ query: " 　 " }))).toBe("Nothing derived into Idea yet");
  });
});

describe("LaneEmpty", () => {
  it.each(LANE_IDS)("offers no Reset filters and no Compose idea on %s when no filter is active", (laneId) => {
    for (const f of [NO_FILTERS, filters({ query: "   " })]) {
      const html = render(laneId, f);
      expect(html).not.toContain("Reset filters");
      expect(html).not.toContain("Compose idea");
      expect(html).not.toContain("<button");
      expect(html).toContain('data-lane-empty="nothing-derived"');
    }
  });

  it.each(LANE_IDS.flatMap((laneId) => ACTIVE.map(([label, f]) => [laneId, label, f] as const)))(
    "offers Reset filters on %s when %s is active, and Compose idea only on the Idea lane",
    (laneId, _label, f) => {
      const html = render(laneId, f);
      expect(html).toContain('data-lane-empty="filtered"');
      expect(html.match(/>Reset filters</g)).toHaveLength(1);
      expect(html.includes("Compose idea")).toBe(laneId === "idea");
    },
  );

  it("renders the spec's filtered Idea lane", () => {
    const html = render("idea", filters({ source: "jira", repositoryId: 701 }));
    expect(text(html)).toBe("No Jira ideas match this repository Reset filters Compose idea");
  });

  it("renders the spec's filtered In progress lane", () => {
    expect(text(render("in-progress", filters({ query: "nope" })))).toBe("No in progress items match these filters Reset filters");
  });

  it("renders the spec's nothing-derived PR/MR lane", () => {
    expect(text(render("pr-mr", NO_FILTERS))).toBe("Nothing derived into PR/MR yet");
  });

  it("disables an unavailable Compose idea and shows the reason as text", () => {
    const html = render("idea", filters({ query: "nope" }), UNAVAILABLE);
    const compose = html.match(/<button([^>]*)>Compose idea<\/button>/);
    expect(compose).not.toBeNull();
    expect(compose![1]).toContain("disabled");
    const describedBy = compose![1].match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>Idea intake is not enabled for this installation yet\\.<`));
  });

  it("shows no reason when Compose idea is available", () => {
    const html = render("idea", filters({ query: "nope" }));
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("aria-describedby");
  });
});
