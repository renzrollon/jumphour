// @vitest-environment jsdom
// workflow-board-ui task 6.5 (specs/workflow-board/spec.md "Render the board
// only from provider-derived state", failure "the provider cannot produce a
// board", and "Distinguish first-use, not-enabled, filtered-empty, and
// loading states", edge case "board is loading"; design.md Decision 8): the
// route-level error view says the board could not be loaded and offers a
// retry — with no card, no lane, no count, no fixture, and no empty-board
// copy, and nothing from the thrown error — and the route-level loading view
// is the board skeleton.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LANES } from "../lib/board/lanes";
import { FIRST_USE_TITLE, NOT_ENABLED_TITLE } from "./components/board/empty-board";
import BoardError from "./error";
import Loading from "./loading";

afterEach(() => {
  cleanup();
});

const LANE_COPY = Object.values(LANES).flatMap((lane) => [lane.title, lane.sublabel, lane.loadingLabel]);
const secretError = Object.assign(new Error("SQLITE_CANTOPEN: /var/data/jumphour.sqlite3"), { digest: "abc123" });

function errorMarkup(): string {
  return renderToStaticMarkup(<BoardError error={secretError} reset={() => {}} />);
}

describe("error view", () => {
  it("says the board could not be loaded and offers a retry", () => {
    const html = errorMarkup();
    expect(html).toContain("The board could not be loaded");
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Retry<\/button>/);
  });

  it("contains no card, no lane, and no lane count", () => {
    const html = errorMarkup();
    expect(html).not.toContain("<article");
    expect(html).not.toContain("data-lane-id");
    expect(html).not.toMatch(/\d+<span[^>]*> cards?</);
    expect(html).not.toContain("aria-pressed");
    for (const copy of LANE_COPY) expect(html).not.toContain(copy);
  });

  it("is not an empty board and shows no sample card", () => {
    const html = errorMarkup();
    expect(html).not.toContain(FIRST_USE_TITLE);
    expect(html).not.toContain(NOT_ENABLED_TITLE);
    expect(html).not.toContain("Snapshot");
  });

  it("reveals nothing from the thrown error", () => {
    const html = errorMarkup();
    for (const leaked of ["SQLITE_CANTOPEN", "/var/data", "abc123"]) expect(html).not.toContain(leaked);
  });

  it("retries through Next's retry when it is supplied, once per activation", async () => {
    const reset = vi.fn();
    const retry = vi.fn();
    render(<BoardError error={secretError} reset={reset} retry={retry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });

  it("falls back to reset when retry is not supplied", async () => {
    const reset = vi.fn();
    render(<BoardError error={secretError} reset={reset} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe("loading view", () => {
  it("is the busy board skeleton with all four lane titles, sublabels, and loading labels", () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Checking listener…");
    for (const copy of LANE_COPY) expect(html).toContain(copy);
    expect(html).not.toContain("<article");
  });
});
