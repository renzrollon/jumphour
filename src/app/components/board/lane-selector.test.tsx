// @vitest-environment jsdom
// Task 5.5 (specs/workflow-board/spec.md "Provide single-lane navigation on
// small screens"): the lane selector is a tablist of the four lanes in board
// order, each with its title and count; the active lane is the selected tab
// and the only one in the Tab order, and arrow keys move and activate.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { LaneId } from "../../../lib/board/board-view-model";
import { parseCssRules } from "../../css-rules.testing";
import { LANE_SELECTOR_LABEL, LaneSelector } from "./lane-selector";

afterEach(() => {
  cleanup();
});

const COUNTS: Record<LaneId, number> = { idea: 3, "openspec-change": 2, "in-progress": 0, "pr-mr": 1 };

function Harness({ onSelectLane }: { onSelectLane?: (laneId: LaneId) => void }) {
  const [active, setActive] = useState<LaneId>("idea");
  return (
    <LaneSelector
      activeLane={active}
      counts={COUNTS}
      onSelectLane={(laneId) => {
        onSelectLane?.(laneId);
        setActive(laneId);
      }}
    />
  );
}

describe("LaneSelector", () => {
  it("lists the four lanes in board order with their titles and counts", () => {
    render(<Harness />);

    const tablist = screen.getByRole("tablist", { name: LANE_SELECTOR_LABEL });
    const tabs = screen.getAllByRole("tab");
    expect(tablist.contains(tabs[0]!)).toBe(true);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Idea3 cards",
      "OpenSpec change2 cards",
      "In progress0 cards",
      "PR/MR1 card",
    ]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it("activates a lane on click and marks it selected", async () => {
    const user = userEvent.setup();
    const onSelectLane = vi.fn();
    render(<Harness onSelectLane={onSelectLane} />);

    await user.click(screen.getByRole("tab", { name: /^PR\/MR/ }));

    expect(onSelectLane).toHaveBeenCalledWith("pr-mr");
    expect(screen.getByRole("tab", { selected: true }).getAttribute("data-lane-id")).toBe("pr-mr");
  });

  it("moves and activates with the arrow keys, Home, and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const selected = () => screen.getByRole("tab", { selected: true }).getAttribute("data-lane-id");

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /^Idea/ }));

    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("openspec-change");
    expect(document.activeElement).toBe(screen.getByRole("tab", { selected: true }));

    await user.keyboard("{End}");
    expect(selected()).toBe("pr-mr");
    await user.keyboard("{ArrowRight}");
    expect(selected()).toBe("idea");
    await user.keyboard("{ArrowLeft}");
    expect(selected()).toBe("pr-mr");
    await user.keyboard("{Home}");
    expect(selected()).toBe("idea");
  });

  // Found by the 8.2 preview check: the visually hidden count text is absolutely
  // positioned, and without a positioned tablist it resolved against the page
  // and scrolled a 400px viewport 45px sideways.
  it("is the containing block for its visually hidden text", () => {
    const css = parseCssRules(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "lane-selector.module.css"), "utf8"));
    const tablist = css.find((rule) => rule.selector === ".tablist" && rule.atRules.length === 0);
    expect(Object.fromEntries(tablist!.declarations)["position"]).toBe("relative");
  });
});
