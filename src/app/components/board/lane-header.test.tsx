// Task 3.4 (specs/workflow-board/spec.md "Show a truthful listener state on
// every lane"): a lane with no configured listener says so and never shows the
// interval line; a degraded listener carries its state in words, not only in
// a color class.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LaneViewModel, ListenerState, ManualRead } from "../../../lib/board/board-view-model";
import { parseCssRules } from "../../css-rules.testing";
import { LaneHeader } from "./lane-header";

const GENERATED_AT = "2026-09-24T12:00:00.000Z";
const minutesBefore = (n: number) => new Date(Date.parse(GENERATED_AT) - n * 60_000).toISOString();

function lane(id: LaneViewModel["id"], listener: ListenerState, manualRead: ManualRead | null = null): LaneViewModel {
  return { id, listener, manualRead, cards: [] };
}

/** Visible and announced text, tags removed. */
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("LaneHeader", () => {
  it("renders the lane's title, count, and sublabel", () => {
    const html = renderToStaticMarkup(
      <LaneHeader lane={lane("openspec-change", { status: "not-configured" })} count={3} generatedAt={GENERATED_AT} />,
    );
    expect(html).toContain("<h2");
    expect(text(html)).toContain("OpenSpec change 3 cards");
    expect(text(html)).toContain("Branch and change artifacts exist");
  });

  it.each(["idea", "openspec-change", "in-progress", "pr-mr"] as const)(
    "says 'Listener not configured' on %s and never 'Listening every'",
    (id) => {
      const html = renderToStaticMarkup(
        <LaneHeader lane={lane(id, { status: "not-configured" })} count={0} generatedAt={GENERATED_AT} />,
      );
      expect(text(html)).toContain("Listener not configured");
      expect(html).not.toContain("Listening every");
      expect(html).not.toContain("Last heard");
    },
  );

  it("shows the interval line and last-heard time for a healthy listener", () => {
    const html = renderToStaticMarkup(
      <LaneHeader
        lane={lane("idea", { status: "healthy", intervalMinutes: 5, lastHeardAt: minutesBefore(2) })}
        count={0}
        generatedAt={GENERATED_AT}
      />,
    );
    expect(text(html)).toContain("Listening every 5 min · Last heard 2 min ago");
  });

  it("states a degraded listener in words, with the class only as reinforcement", () => {
    const html = renderToStaticMarkup(
      <LaneHeader
        lane={lane("in-progress", {
          status: "delayed",
          intervalMinutes: 5,
          lastSuccessAt: minutesBefore(14),
          retrying: true,
        })}
        count={0}
        generatedAt={GENERATED_AT}
      />,
    );
    expect(text(html)).toContain("Listening delayed · retrying · Last successful listen 14 min ago");

    const healthy = renderToStaticMarkup(
      <LaneHeader
        lane={lane("in-progress", { status: "healthy", intervalMinutes: 5, lastHeardAt: minutesBefore(14) })}
        count={0}
        generatedAt={GENERATED_AT}
      />,
    );
    // Stripped of markup and classes, the two headers still read differently.
    expect(text(html)).not.toBe(text(healthy));
  });

  it("reinforces a degraded listener's words with the amber tone, as the prototype does", () => {
    const css = parseCssRules(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "lane-header.module.css"), "utf8"));
    const degraded = css.find((rule) => rule.selector === ".degraded" && rule.atRules.length === 0);
    expect(Object.fromEntries(degraded!.declarations)).toMatchObject({ color: "var(--amber)", "font-weight": "600" });
  });

  it("renders the manual-read control from the provider's manualRead, and none without one", () => {
    const manualRead: ManualRead = {
      kind: "load-ideas",
      availability: { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." },
      options: [],
    };
    const render = vi.fn((read: ManualRead) => <button type="button">{read.kind}</button>);

    const withControl = renderToStaticMarkup(
      <LaneHeader
        lane={lane("idea", { status: "not-configured" }, manualRead)}
        count={0}
        generatedAt={GENERATED_AT}
        renderManualRead={render}
      />,
    );
    expect(render).toHaveBeenCalledWith(manualRead);
    expect(withControl).toContain("load-ideas");

    render.mockClear();
    const without = renderToStaticMarkup(
      <LaneHeader
        lane={lane("openspec-change", { status: "not-configured" })}
        count={0}
        generatedAt={GENERATED_AT}
        renderManualRead={render}
      />,
    );
    expect(render).not.toHaveBeenCalled();
    expect(without).not.toContain("<button");
  });
});

// Task 3.5 (spec "Offer manual reads only on the Idea and PR/MR lanes", edge
// case "middle lanes never get a manual control"; design.md Decision 2).
describe("LaneHeader manual-read gating", () => {
  const loadIdeas: ManualRead = {
    kind: "load-ideas",
    availability: { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." },
    options: [],
  };
  const fetchPrs: ManualRead = {
    kind: "fetch-pull-requests",
    availability: { status: "unavailable", reason: "PR and MR fetching is not enabled for this installation yet." },
    options: [],
  };

  it("renders a disabled Load ideas control with its reason as visible text on the Idea lane", () => {
    const html = renderToStaticMarkup(
      <LaneHeader lane={lane("idea", { status: "not-configured" }, loadIdeas)} count={0} generatedAt={GENERATED_AT} />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Load ideas<\/button>/);
    expect(text(html)).toContain("Idea intake is not enabled for this installation yet.");
  });

  it("renders a disabled Fetch PRs/MRs control with its reason as visible text on the PR/MR lane", () => {
    const html = renderToStaticMarkup(
      <LaneHeader lane={lane("pr-mr", { status: "not-configured" }, fetchPrs)} count={0} generatedAt={GENERATED_AT} />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Fetch PRs\/MRs<\/button>/);
    expect(text(html)).toContain("PR and MR fetching is not enabled for this installation yet.");
  });

  it.each(["in-progress", "openspec-change"] as const)(
    "renders no control when a model wrongly attaches a manualRead to %s",
    (id) => {
      const render = vi.fn((read: ManualRead) => <button type="button">{read.kind}</button>);
      for (const read of [loadIdeas, fetchPrs]) {
        const html = renderToStaticMarkup(
          <LaneHeader lane={lane(id, { status: "not-configured" }, read)} count={0} generatedAt={GENERATED_AT} />,
        );
        expect(html).not.toContain("<button");
        expect(html).not.toContain("not enabled");

        const overridden = renderToStaticMarkup(
          <LaneHeader
            lane={lane(id, { status: "not-configured" }, read)}
            count={0}
            generatedAt={GENERATED_AT}
            renderManualRead={render}
          />,
        );
        expect(overridden).not.toContain("<button");
      }
      expect(render).not.toHaveBeenCalled();
    },
  );

  it("ignores a manualRead of the other lane's kind", () => {
    const html = renderToStaticMarkup(
      <LaneHeader lane={lane("idea", { status: "not-configured" }, fetchPrs)} count={0} generatedAt={GENERATED_AT} />,
    );
    expect(html).not.toContain("<button");
  });
});
