// @vitest-environment jsdom
// Task 4.3: legend popover — three statements, four rules in board order,
// Escape closes it and focus returns to the trigger.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LANES, LANE_IDS } from "../../../lib/board/lanes";
import { LEGEND_NO_MANUAL, LEGEND_NO_WRITES, LEGEND_SUMMARY, LegendPopover } from "./legend-popover";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const trigger = () => screen.getByRole("button", { name: "How column placement works", hidden: true });

describe("LegendPopover", () => {
  it("shows the three statements and the four rules in board order", async () => {
    const user = userEvent.setup();
    render(<LegendPopover />);
    await user.click(trigger());
    const dialog = screen.getByRole("dialog", { name: "How column placement works", hidden: true });
    const text = dialog.textContent ?? "";
    expect(text).toContain("Column placement is calculated from source, OpenSpec, session, and PR/MR evidence.");
    expect(text).toContain(LEGEND_SUMMARY);
    expect(text).toContain(LEGEND_NO_MANUAL);
    expect(text).toContain(LEGEND_NO_WRITES);
    const items = Array.from(dialog.querySelectorAll("li")).map((li) => li.textContent);
    expect(items).toEqual(LANE_IDS.map((id) => `${LANES[id].title} — ${LANES[id].legendRule}`));
    expect(items.map((t) => t!.split(" — ")[0])).toEqual(["Idea", "OpenSpec change", "In progress", "PR/MR"]);
  });

  it("uses a round \"i\" trigger whose glyph is hidden and whose name is the label", () => {
    render(<LegendPopover open={false} onOpenChange={() => {}} />);
    const button = trigger();
    expect(button.textContent).toBe("i");
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe("i");
    expect(button.getAttribute("aria-label")).toBe("How column placement works");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<LegendPopover />);
    await user.click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
