// workflow-board-ui task 7.2 (design.md Decision 10; specs/ui-preview-gallery
// /spec.md "Reproduce the designed board scenarios by name"): scenario names
// match without regard to case or surrounding whitespace, an unknown name
// falls back to `populated`, and each of the six scenarios carries the
// prototype's listener effects — `source-error` delays In progress and puts
// the PR/MR last success 48 min back while every card stays on the board.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NO_FILTERS, cardMatchesFilters } from "../../../../lib/board/filter-cards";
import { formatListenerState } from "../../../../lib/board/listener-text";
import { LANE_IDS } from "../../../../lib/board/lanes";
import { laneEmptyText } from "../../../components/board/lane-empty";
import { LaneHeader } from "../../../components/board/lane-header";
import { BOARD_FIXTURE_CARDS, BOARD_FIXTURE_GENERATED_AT, BOARD_SCENARIOS, boardScenario, parseScenario } from "./board";

/** Visible and announced text, tags removed. */
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const laneCounts = (name: (typeof BOARD_SCENARIOS)[number]) =>
  boardScenario(name).view.lanes.map((lane) => lane.cards.length);

describe("parseScenario", () => {
  it.each(BOARD_SCENARIOS)("resolves %s to itself", (name) => {
    expect(parseScenario(name)).toBe(name);
  });

  it.each(["Loading", " loading ", "LOADING", "\tloading\n"])("resolves %j to loading", (raw) => {
    expect(parseScenario(raw)).toBe("loading");
  });

  it.each(["does-not-exist", "", "   ", "filtered empty", undefined, null])("resolves %j to populated", (raw) => {
    expect(parseScenario(raw)).toBe("populated");
  });

  it("reads the first value of a repeated parameter", () => {
    expect(parseScenario([" Source-Error ", "empty"])).toBe("source-error");
    expect(parseScenario([])).toBe("populated");
  });
});

describe("boardScenario", () => {
  it.each(BOARD_SCENARIOS)("%s is a four-lane, plain-JSON view named for its scenario", (name) => {
    const scenario = boardScenario(name);
    expect(scenario.name).toBe(name);
    expect(scenario.view.lanes.map((lane) => lane.id)).toEqual([...LANE_IDS]);
    expect(scenario.view.generatedAt).toBe(BOARD_FIXTURE_GENERATED_AT);
    expect(JSON.parse(JSON.stringify(scenario.view))).toEqual(scenario.view);
    expect(scenario.view.lanes.map((lane) => lane.manualRead?.kind ?? null)).toEqual([
      "load-ideas",
      null,
      null,
      "fetch-pull-requests",
    ]);
  });

  it("builds a fresh view on every call", () => {
    const first = boardScenario("populated");
    first.view.lanes[0].cards.length = 0;
    expect(laneCounts("populated")).toEqual([4, 3, 3, 3]);
  });

  it("populated: all 13 cards 4 / 3 / 3 / 3 under healthy listeners at the prototype's heard times", () => {
    const { view, pending } = boardScenario("populated");
    expect(pending).toBe(false);
    expect(laneCounts("populated")).toEqual([4, 3, 3, 3]);
    expect(view.lanes.map((lane) => formatListenerState(lane.listener, view.generatedAt))).toEqual([
      { intervalLine: "Listening every 5 min", heardLine: "Last heard 2 min ago", degraded: false },
      { intervalLine: "Listening every 5 min", heardLine: "Last heard 4 min ago", degraded: false },
      { intervalLine: "Listening every 5 min", heardLine: "Last heard 1 min ago", degraded: false },
      { intervalLine: "Listening every 5 min", heardLine: "Last heard 14 min ago", degraded: false },
    ]);
  });

  it("loading: the populated board, mid-read", () => {
    const loading = boardScenario("loading");
    expect(loading.pending).toBe(true);
    expect(loading.view).toEqual(boardScenario("populated").view);
  });

  it("empty: no cards, with Load ideas and Compose idea available", () => {
    const { view } = boardScenario("empty");
    expect(laneCounts("empty")).toEqual([0, 0, 0, 0]);
    expect(view.compose).toEqual({ status: "available" });
    expect(view.lanes[0].manualRead?.availability).toEqual({ status: "available" });
    expect(view.lanes[0].manualRead?.options.map((option) => option.label)).toEqual([
      "GitHub Issues",
      "GitLab issues",
      "Jira",
      "Manual inbox",
    ]);
  });

  it("filtered-empty: opens filtered to Jira in acme/mobile-shell, leaving only MOB-77 visible", () => {
    const { view, filters } = boardScenario("filtered-empty");
    // Every card stays in the view, so Reset filters restores the whole board.
    expect(laneCounts("filtered-empty")).toEqual([4, 3, 3, 3]);
    const mobileShell = view.repositories.find((repository) => repository.fullName === "acme/mobile-shell")!;
    expect(filters).toEqual({ ...NO_FILTERS, source: "jira", repositoryId: mobileShell.githubRepoId });
    const visible = view.lanes.map((lane) => lane.cards.filter((card) => cardMatchesFilters(card, filters)));
    expect(visible.map((cards) => cards.length)).toEqual([0, 0, 1, 0]);
    expect(visible[2]![0]!.source).toEqual({ kind: "jira", key: "MOB-77" });
    expect(laneEmptyText("idea", filters)).toBe("No Jira ideas match this repository");
    expect(view.repositories).toHaveLength(3);
  });

  it("opens every other scenario unfiltered", () => {
    for (const name of BOARD_SCENARIOS.filter((scenario) => scenario !== "filtered-empty")) {
      expect(boardScenario(name).filters).toEqual(NO_FILTERS);
    }
  });

  it("source-error: In progress is delayed and retrying, PR/MR is delayed with its last success 48 min ago, and every card stays", () => {
    const { view, pending } = boardScenario("source-error");
    expect(pending).toBe(false);
    expect(laneCounts("source-error")).toEqual([4, 3, 3, 3]);

    const [idea, change, progress, prMr] = view.lanes;
    expect(progress.listener).toMatchObject({ status: "delayed", retrying: true });
    expect(formatListenerState(progress.listener, view.generatedAt)).toMatchObject({
      intervalLine: "Listening delayed · retrying",
      degraded: true,
    });
    expect(prMr.listener).toMatchObject({ status: "delayed", retrying: false });
    expect(formatListenerState(prMr.listener, view.generatedAt)).toEqual({
      intervalLine: "Listening delayed",
      heardLine: "Last successful listen 48 min ago",
      degraded: true,
    });
    expect(idea.listener.status).toBe("healthy");
    expect(change.listener.status).toBe("healthy");

    const headers = view.lanes.map((lane) =>
      text(renderToStaticMarkup(<LaneHeader lane={lane} count={lane.cards.length} generatedAt={view.generatedAt} />)),
    );
    expect(headers[2]).toContain("Listening delayed · retrying");
    expect(headers[3]).toContain("Last successful listen 48 min ago");
    expect(view.lanes.flatMap((lane) => lane.cards.map((card) => card.id))).toEqual(
      BOARD_FIXTURE_CARDS.map((card) => card.id),
    );
  });

  it("jira-failed: only the Idea lane is degraded, and every card stays", () => {
    const { view } = boardScenario("jira-failed");
    expect(laneCounts("jira-failed")).toEqual([4, 3, 3, 3]);
    expect(view.lanes.map((lane) => formatListenerState(lane.listener, view.generatedAt).degraded)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(formatListenerState(view.lanes[0].listener, view.generatedAt)).toEqual({
      intervalLine: "Listening delayed · retrying",
      heardLine: "Last successful listen 2 min ago",
      degraded: true,
    });
  });
});
