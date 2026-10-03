// @vitest-environment jsdom
// Task 4.2 (specs/workflow-board/spec.md "Offer manual reads only on the Idea
// and PR/MR lanes"): the Load ideas and Fetch PRs/MRs menus state their
// read-only notices verbatim, label every option in text with an MCP mark
// where the provider says so, and request exactly the chosen read once. An
// unavailable control shows its reason, opens no menu, and requests nothing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManualRead } from "../../../lib/board/board-view-model";
import { ManualReadMenu } from "./manual-read-menu";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const LOAD_IDEAS: ManualRead = {
  kind: "load-ideas",
  availability: { status: "available" },
  options: [
    { id: "github-issues", label: "GitHub Issues", badge: "github", viaMcp: true },
    { id: "gitlab-issues", label: "GitLab issues", badge: "gitlab", viaMcp: true },
    { id: "jira", label: "Jira", badge: "jira", viaMcp: true },
    { id: "manual-inbox", label: "Manual inbox", badge: "manual", viaMcp: false },
  ],
};

const FETCH: ManualRead = {
  kind: "fetch-pull-requests",
  availability: { status: "available" },
  options: [
    { id: "github-pull-requests", label: "GitHub pull requests", badge: "github", viaMcp: false },
    { id: "gitlab-merge-requests", label: "GitLab merge requests", badge: "gitlab", viaMcp: false },
  ],
};

const LOAD_NOTICE = "Reads the selected source now and captures snapshots. Never writes back.";
const FETCH_NOTICE = "Read-only MCP fetch. No comments, reviews, or labels.";

describe("ManualReadMenu — available", () => {
  it("opens Load ideas with its notice verbatim and text-labelled, MCP-marked options", async () => {
    const user = userEvent.setup();
    render(<ManualReadMenu manualRead={LOAD_IDEAS} />);

    await user.click(screen.getByRole("button", { name: "Load ideas" }));

    const menu = screen.getByRole("menu", { name: "Load ideas from" });
    expect(menu.textContent).toContain(LOAD_NOTICE);
    expect(document.getElementById(menu.getAttribute("aria-describedby")!)?.textContent).toBe(LOAD_NOTICE);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "GitHub Issues, read via MCP",
      "GitLab issues, read via MCP",
      "Jira, read via MCP",
      "Manual inbox",
    ]);
  });

  it("opens Fetch PRs/MRs with its notice verbatim", async () => {
    const user = userEvent.setup();
    render(<ManualReadMenu manualRead={FETCH} size="compact" />);

    await user.click(screen.getByRole("button", { name: "Fetch PRs/MRs" }));

    const menu = screen.getByRole("menu", { name: "Fetch from" });
    expect(menu.textContent).toContain(FETCH_NOTICE);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "GitHub pull requests",
      "GitLab merge requests",
    ]);
  });

  it("calls onManualRead(kind, optionId) exactly once for the chosen option and closes", async () => {
    const user = userEvent.setup();
    const onManualRead = vi.fn();
    render(<ManualReadMenu manualRead={LOAD_IDEAS} onManualRead={onManualRead} />);

    await user.click(screen.getByRole("button", { name: "Load ideas" }));
    await user.click(screen.getByRole("menuitem", { name: "Jira, read via MCP" }));

    expect(onManualRead).toHaveBeenCalledTimes(1);
    expect(onManualRead).toHaveBeenCalledWith("load-ideas", "jira");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("requests the fetch the keyboard chooses", async () => {
    const user = userEvent.setup();
    const onManualRead = vi.fn();
    render(<ManualReadMenu manualRead={FETCH} onManualRead={onManualRead} />);

    screen.getByRole("button", { name: "Fetch PRs/MRs" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onManualRead).toHaveBeenCalledTimes(1);
    expect(onManualRead).toHaveBeenCalledWith("fetch-pull-requests", "gitlab-merge-requests");
  });
});

describe("ManualReadMenu — unavailable", () => {
  const REASON = "Idea intake is not enabled for this installation yet.";
  const UNAVAILABLE: ManualRead = { ...LOAD_IDEAS, availability: { status: "unavailable", reason: REASON } };

  it("is disabled with the reason as visible text it points to", () => {
    render(<ManualReadMenu manualRead={UNAVAILABLE} />);
    const button = screen.getByRole("button", { name: "Load ideas" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-haspopup")).toBeNull();
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe(REASON);
    expect(screen.getByText(REASON)).not.toBeNull();
  });

  it("opens no menu and calls nothing when activated", async () => {
    const user = userEvent.setup();
    const onManualRead = vi.fn();
    render(<ManualReadMenu manualRead={UNAVAILABLE} onManualRead={onManualRead} />);
    const button = screen.getByRole("button", { name: "Load ideas" });

    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onManualRead).not.toHaveBeenCalled();
  });
});
