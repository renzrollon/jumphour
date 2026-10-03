// @vitest-environment jsdom
// workflow-board-ui task 7.3 (design.md Decision 8, "Manual-read pending"):
// the preview's manual-read handler simulates a read — choosing a Load ideas
// source turns every lane into busy placeholders under its real header for
// 1.4 s, then the same fixture board returns.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dev/ui/board",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../components/shell/appearance-actions", () => ({
  setThemePreference: vi.fn(),
  setCatsPreference: vi.fn(),
}));

import { BoardPreview, SIMULATED_READ_MS } from "./board-preview";
import { boardScenario } from "../fixtures/board";
import { PREVIEW_ACCOUNT, PREVIEW_WORKSPACE } from "../fixtures/shell";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const pendingLanes = () => document.querySelectorAll("[data-lane-pending]").length;

describe("BoardPreview", () => {
  it("holds a chosen manual read pending for 1.4 s, then shows the board again", () => {
    vi.useFakeTimers();
    render(<BoardPreview scenario={boardScenario("populated")} shell={{ workspace: PREVIEW_WORKSPACE, account: PREVIEW_ACCOUNT }} />);
    expect(pendingLanes()).toBe(0);

    const idea = screen.getByRole("region", { name: "Idea" });
    fireEvent.click(within(idea).getByRole("button", { name: /Load ideas/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /GitHub Issues/ }));

    expect(pendingLanes()).toBe(4);
    expect(screen.getByRole("region", { name: "Idea" }).getAttribute("aria-busy")).toBe("true");

    act(() => vi.advanceTimersByTime(SIMULATED_READ_MS - 1));
    expect(pendingLanes()).toBe(4);
    act(() => vi.advanceTimersByTime(1));
    expect(pendingLanes()).toBe(0);
    expect(screen.getByRole("button", { name: "Support request-level idempotency keys" })).toBeTruthy();
  });

  it("labels the page as fixture data and marks the displayed scenario", () => {
    render(<BoardPreview scenario={boardScenario("jira-failed")} shell={{}} />);
    expect(screen.getByRole("note", { name: "Preview" }).textContent).toContain("Preview — fixture data · Scenario: jira-failed");
    const current = within(screen.getByRole("navigation", { name: "Board scenarios" })).getByRole("link", { current: "page" });
    expect(current.textContent).toBe("jira-failed");
  });
});
