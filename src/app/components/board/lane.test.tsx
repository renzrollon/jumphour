// @vitest-environment jsdom
// Task 3.6 (specs/workflow-board/spec.md "Present a fixed four-lane projection
// board" and "Distinguish first-use, not-enabled, filtered-empty, and loading
// states"): a lane renders its header with the count of the cards it is given,
// those cards, or — when it is given none — its empty state, whose actions
// report back through the lane's callbacks.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Availability, CardViewModel, LaneViewModel } from "../../../lib/board/board-view-model";
import { NO_FILTERS, type BoardFilters } from "../../../lib/board/filter-cards";
import { Lane } from "./lane";

afterEach(() => {
  cleanup();
});

const GENERATED_AT = "2026-09-24T12:00:00.000Z";
const AVAILABLE: Availability = { status: "available" };

function card(id: string, laneId: CardViewModel["laneId"], title: string): CardViewModel {
  return {
    id,
    laneId,
    source: { kind: "manual", key: null },
    title,
    changeName: null,
    repository: null,
    owner: null,
    relevance: null,
    freshness: { kind: "composed", at: GENERATED_AT },
    evidence: { tone: "neutral", text: "Created in Jumphour" },
    agentNote: null,
    footer: "Idea",
    externalHostLabel: null,
  };
}

function lane(id: LaneViewModel["id"], cards: CardViewModel[] = []): LaneViewModel {
  return { id, listener: { status: "not-configured" }, manualRead: null, cards };
}

function renderLane(props: {
  laneModel: LaneViewModel;
  cards: readonly CardViewModel[];
  filters?: BoardFilters;
  selectedCardId?: string | null;
  onSelectCard?: (id: string) => void;
  onResetFilters?: () => void;
  onCompose?: () => void;
}) {
  return render(
    <Lane
      lane={props.laneModel}
      cards={props.cards}
      filters={props.filters ?? NO_FILTERS}
      generatedAt={GENERATED_AT}
      compose={AVAILABLE}
      selectedCardId={props.selectedCardId ?? null}
      onSelectCard={props.onSelectCard}
      onResetFilters={props.onResetFilters}
      onCompose={props.onCompose}
    />,
  );
}

describe("Lane", () => {
  it("is a region named by the lane title, with a header counting the cards it shows", () => {
    const cards = [card("a", "in-progress", "Alpha"), card("b", "in-progress", "Beta")];
    renderLane({ laneModel: lane("in-progress", cards), cards });

    const region = screen.getByRole("region", { name: "In progress" });
    expect(within(region).getByRole("heading", { level: 2, name: "In progress" })).toBeTruthy();
    expect(region.textContent).toContain("2 cards");
    expect(within(region).getAllByRole("article")).toHaveLength(2);
    expect(within(region).queryByText(/Nothing derived/)).toBeNull();
  });

  it("counts the cards it is given, not the lane's unfiltered cards", () => {
    const all = [card("a", "idea", "Alpha"), card("b", "idea", "Beta"), card("c", "idea", "Gamma")];
    renderLane({ laneModel: lane("idea", all), cards: [all[1]!], filters: { ...NO_FILTERS, query: "beta" } });

    const region = screen.getByRole("region", { name: "Idea" });
    expect(region.textContent).toContain("1 card");
    expect(within(region).getAllByRole("article")).toHaveLength(1);
    expect(within(region).getByRole("button", { name: "Beta" })).toBeTruthy();
  });

  it("marks the selected card and reports activation by id", async () => {
    const onSelectCard = vi.fn();
    const cards = [card("a", "pr-mr", "Alpha"), card("b", "pr-mr", "Beta")];
    renderLane({ laneModel: lane("pr-mr", cards), cards, selectedCardId: "b", onSelectCard });

    expect(screen.getByRole("button", { name: "Alpha" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Beta" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onSelectCard).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("shows the nothing-derived state with no actions when no filter is active", () => {
    renderLane({ laneModel: lane("pr-mr"), cards: [] });

    const region = screen.getByRole("region", { name: "PR/MR" });
    expect(within(region).getByText("Nothing derived into PR/MR yet")).toBeTruthy();
    expect(region.textContent).toContain("0 cards");
    expect(within(region).queryByRole("button")).toBeNull();
  });

  it("shows the filtered-empty state on the Idea lane with Reset filters and Compose idea", async () => {
    const onResetFilters = vi.fn();
    const onCompose = vi.fn();
    const all = [card("a", "idea", "Alpha")];
    renderLane({
      laneModel: lane("idea", all),
      cards: [],
      filters: { ...NO_FILTERS, source: "jira", repositoryId: 701 },
      onResetFilters,
      onCompose,
    });

    const region = screen.getByRole("region", { name: "Idea" });
    expect(within(region).getByText("No Jira ideas match this repository")).toBeTruthy();
    await userEvent.click(within(region).getByRole("button", { name: "Reset filters" }));
    expect(onResetFilters).toHaveBeenCalledOnce();
    await userEvent.click(within(region).getByRole("button", { name: "Compose idea" }));
    expect(onCompose).toHaveBeenCalledOnce();
  });

  it("offers Reset filters but not Compose idea on a filtered middle lane", () => {
    renderLane({ laneModel: lane("in-progress"), cards: [], filters: { ...NO_FILTERS, query: "nope" } });

    const region = screen.getByRole("region", { name: "In progress" });
    expect(within(region).getByText("No in progress items match these filters")).toBeTruthy();
    expect(within(region).getByRole("button", { name: "Reset filters" })).toBeTruthy();
    expect(within(region).queryByRole("button", { name: "Compose idea" })).toBeNull();
  });
});
