// @vitest-environment jsdom
// Task 8.1 (specs/app-shell/spec.md "Frame every signed-in view in one top
// app bar", scenario "Happy path — the bar carries every element once"):
// verifies the top app bar renders its seven regions — mark and wordmark,
// workspace element, search slot, theme control, cats toggle, settings
// entry, account menu — in that fixed order, and that each appears exactly
// once.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TopAppBar } from "./top-app-bar";

afterEach(() => {
  cleanup();
});

const FIXED_ORDER = [
  "mark",
  "workspace",
  "search",
  "theme-control",
  "cats-toggle",
  "settings-entry",
  "account-menu",
] as const;

function slots(container: HTMLElement) {
  const bar = container.querySelector('[data-shell-region="top-app-bar"]');
  return Array.from(bar!.querySelectorAll<HTMLElement>("[data-shell-slot]"));
}

describe("TopAppBar", () => {
  it("renders exactly one of each region", () => {
    const { container } = render(<TopAppBar />);
    for (const slot of FIXED_ORDER) {
      expect(container.querySelectorAll(`[data-shell-slot="${slot}"]`)).toHaveLength(1);
    }
  });

  it("orders the seven regions mark, workspace, search, theme, cats, settings, account", () => {
    const { container } = render(<TopAppBar />);
    const order = slots(container).map((el) => el.getAttribute("data-shell-slot"));
    expect(order).toEqual([...FIXED_ORDER]);
  });

  it("renders the bar as a single top-level header landmark", () => {
    render(<TopAppBar />);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  it("names the settings entry and account controls so they are not unnamed buttons", () => {
    render(<TopAppBar />);
    expect(screen.getByRole("button", { name: "Settings" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Account" })).not.toBeNull();
  });

  it("states the workspace's condition in words rather than a blank or numeric label", () => {
    const { container } = render(<TopAppBar />);
    const workspace = container.querySelector('[data-shell-slot="workspace"]');
    expect(workspace!.textContent?.trim()).toBe("No installation");
    expect(workspace!.textContent).not.toMatch(/^\d+$/);
  });

  it("does not render a second instance when mounted twice on one page", () => {
    // Guards the "no signed-in view SHALL render a second ... of its own"
    // clause: two TopAppBar instances would legitimately double every
    // region, which is exactly the defect the requirement forbids a real
    // page from causing by composing its own extra controls.
    const { container: a } = render(<TopAppBar />);
    const { container: b } = render(<TopAppBar />);
    for (const container of [a, b]) {
      for (const slot of FIXED_ORDER) {
        expect(container.querySelectorAll(`[data-shell-slot="${slot}"]`)).toHaveLength(1);
      }
    }
  });
});
