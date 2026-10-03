// Task 3.8 (spec "Distinguish first-use, not-enabled, filtered-empty, and
// loading states", edge case "board is loading"; design.md Decision 8): the
// loading board keeps all four real lane headers, shows "…" and "Checking
// listener…", labels each lane's placeholders with its loadingLabel, and is
// announced busy.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LANE_IDS, LANES } from "../../../lib/board/lanes";
import { BoardSkeleton } from "./board-skeleton";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("BoardSkeleton", () => {
  const html = renderToStaticMarkup(<BoardSkeleton />);

  it("renders four real lane headers with every title and sublabel, in board order", () => {
    const titles = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]);
    expect(titles).toEqual(LANE_IDS.map((id) => LANES[id].title));
    for (const id of LANE_IDS) {
      expect(text(html)).toContain(LANES[id].sublabel);
    }
  });

  it("shows '…' for every count and 'Checking listener…' on every lane", () => {
    expect(html.match(/Checking listener…/g)).toHaveLength(4);
    expect(html.match(/>…</g)).toHaveLength(4);
    expect(html).not.toContain("Listener not configured");
  });

  it("labels each lane's placeholders with its loadingLabel and marks it busy", () => {
    expect(html).toMatch(/^<div[^>]*aria-busy="true"/);
    for (const id of LANE_IDS) {
      const lane = html.match(new RegExp(`<section[^>]*data-lane-id="${id}"[^>]*>`))?.[0];
      expect(lane).toContain('aria-busy="true"');
      expect(text(html)).toContain(LANES[id].loadingLabel);
    }
    expect(html.match(/role="status"/g)).toHaveLength(4);
  });

  it("renders no manual-read control and no cards", () => {
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<article");
  });
});
