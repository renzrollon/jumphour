// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Banner } from "./banner";

afterEach(() => {
  cleanup();
});

describe("Banner", () => {
  it("renders a polite status region by default, naming the state in text", () => {
    render(<Banner title="GitHub could not be reached">The last two listens failed.</Banner>);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("GitHub could not be reached");
    expect(status.textContent).toContain("The last two listens failed.");
  });

  it("renders an assertive alert for the bad tone", () => {
    render(<Banner tone="bad" title="Sign-in failed" />);
    expect(screen.getByRole("alert").textContent).toContain("Sign-in failed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides its tone icon from assistive technology, leaving the title text as the announced content", () => {
    const { container } = render(<Banner tone="warn" title="Jira via MCP is unavailable" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders an optional action and calls it on activation", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Banner title="Jira via MCP is unavailable" action={{ label: "Retry Jira source", onClick }} />);
    await user.click(screen.getByRole("button", { name: "Retry Jira source" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders no action button when none is given", () => {
    render(<Banner title="Jira via MCP is unavailable" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
