// Task 3.7 (specs/workflow-board/spec.md "Distinguish first-use, not-enabled,
// filtered-empty, and loading states"): the first-use and intake-not-enabled
// empty boards. Neither contains a prototype sample card; the not-enabled one
// says intake is not enabled for this installation yet and shows both actions
// disabled with their reasons as visible text.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Availability } from "../../../lib/board/board-view-model";
import { EmptyBoard } from "./empty-board";

const AVAILABLE: Availability = { status: "available" };
const INTAKE_REASON = "Idea intake is not enabled for this installation yet.";
const NOT_ENABLED: Availability = { status: "unavailable", reason: INTAKE_REASON };

/** The prototype's 13 sample card titles (Jumphour Board.dc.html lines 661–675). */
const FIXTURE_TITLES = [
  "Support request-level idempotency keys",
  "Give finance export failures an actionable retry path",
  "Expose tenant-level webhook delivery metrics",
  "Compare hosted runners against the overnight queue",
  "Add idempotency keys to payment intents",
  "Rate-limit bulk invoice regeneration",
  "Consolidate feature flag SDK initialization",
  "Stream audit log exports instead of buffering",
  "Offline queue for shell telemetry",
  "Per-tenant rate limit headers",
  "Add retryable finance exports",
  "Add tenant delivery metrics",
  "Harden shell deep-link parsing",
];

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Each `<button …>label</button>` as { label, disabled, describedBy }. */
function buttons(html: string) {
  return [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => ({
    label,
    disabled: / disabled=""/.test(attrs!),
    describedBy: / aria-describedby="([^"]+)"/.exec(attrs!)?.[1],
  }));
}

const firstUse = renderToStaticMarkup(<EmptyBoard loadIdeas={AVAILABLE} compose={AVAILABLE} />);
const notEnabled = renderToStaticMarkup(<EmptyBoard loadIdeas={NOT_ENABLED} compose={NOT_ENABLED} />);

describe("EmptyBoard", () => {
  it.each([
    ["first-use", firstUse],
    ["not-enabled", notEnabled],
  ])("the %s variant contains no fixture title", (_variant, html) => {
    for (const title of FIXTURE_TITLES) expect(html).not.toContain(title);
    expect(html).not.toContain("<article");
  });

  it("first-use names both paths and offers enabled Load ideas and Compose idea", () => {
    expect(text(firstUse)).toContain("No ideas on this board yet");
    expect(text(firstUse)).toContain("read-only snapshots");
    expect(text(firstUse)).toContain("compose one here");
    expect(buttons(firstUse)).toEqual([
      { label: "Load ideas", disabled: false, describedBy: undefined },
      { label: "Compose idea", disabled: false, describedBy: undefined },
    ]);
  });

  it("not-enabled explains intake is not enabled for this installation yet", () => {
    expect(notEnabled).toContain('data-variant="not-enabled"');
    expect(text(notEnabled)).toContain("Idea intake is not enabled for this installation yet");
    expect(notEnabled).not.toContain("No ideas on this board yet");
  });

  it("not-enabled disables both actions and shows the reason as visible text they point to", () => {
    const [load, compose] = buttons(notEnabled);
    expect(load).toMatchObject({ label: "Load ideas", disabled: true });
    expect(compose).toMatchObject({ label: "Compose idea", disabled: true });
    expect(load!.describedBy).toBeDefined();
    expect(compose!.describedBy).toBe(load!.describedBy);
    const reason = new RegExp(`<p id="${load!.describedBy}"[^>]*>([^<]*)</p>`).exec(notEnabled);
    expect(reason?.[1]).toBe(INTAKE_REASON);
  });

  it("shows each distinct reason next to the action it disables", () => {
    const html = renderToStaticMarkup(
      <EmptyBoard loadIdeas={NOT_ENABLED} compose={{ status: "unavailable", reason: "Compose is paused." }} />,
    );
    const [load, compose] = buttons(html);
    expect(load!.describedBy).not.toBe(compose!.describedBy);
    expect(text(html)).toContain(INTAKE_REASON);
    expect(text(html)).toContain("Compose is paused.");
  });

  it("keeps first-use when only one action is unavailable, disabling just that one", () => {
    const html = renderToStaticMarkup(<EmptyBoard loadIdeas={NOT_ENABLED} compose={AVAILABLE} />);
    expect(html).toContain('data-variant="first-use"');
    expect(buttons(html).map((b) => b.disabled)).toEqual([true, false]);
    expect(text(html)).toContain(INTAKE_REASON);
  });

  it("carries the cats accent only as hidden decoration", () => {
    const hidden = [...notEnabled.matchAll(/<div aria-hidden="true"/g)];
    expect(hidden).toHaveLength(2);
    expect(notEnabled).toContain("<svg");
  });
});
