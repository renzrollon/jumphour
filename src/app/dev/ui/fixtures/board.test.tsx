// workflow-board-ui task 7.1 (design.md Decision 10): the prototype's 13
// cards, transcribed to `CardViewModel`, land 4 / 3 / 3 / 3 across the four
// lanes, and their freshness reproduces deterministically against the fixed
// generation instant — the first card reads "Snapshot 14 min ago".
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LANE_IDS } from "../../../../lib/board/lanes";
import { BoardCard, formatFreshness } from "../../../components/board/board-card";
import {
  BOARD_FIXTURE_CARDS,
  BOARD_FIXTURE_GENERATED_AT,
  BOARD_FIXTURE_REPOSITORIES,
  fixtureCardsInLane,
} from "./board";

describe("board fixture cards", () => {
  it("transcribes all 13 prototype cards with unique ids, in prototype order", () => {
    expect(BOARD_FIXTURE_CARDS.map((card) => card.id)).toEqual(
      Array.from({ length: 13 }, (_, index) => `c${index + 1}`),
    );
  });

  it("distributes the cards 4 / 3 / 3 / 3 across Idea, OpenSpec change, In progress, PR/MR", () => {
    expect(LANE_IDS.map((laneId) => fixtureCardsInLane(laneId).length)).toEqual([4, 3, 3, 3]);
  });

  it("renders 'Snapshot 14 min ago' for the first card against the fixed generation instant", () => {
    const first = BOARD_FIXTURE_CARDS[0]!;
    expect(first.title).toBe("Support request-level idempotency keys");
    expect(formatFreshness(first.freshness, BOARD_FIXTURE_GENERATED_AT)).toBe("Snapshot 14 min ago");
    const html = renderToStaticMarkup(
      <BoardCard card={first} generatedAt={BOARD_FIXTURE_GENERATED_AT} selected={false} />,
    );
    expect(html).toContain("Snapshot 14 min ago");
  });

  it("reproduces the prototype's other freshness lines", () => {
    const freshness = Object.fromEntries(
      BOARD_FIXTURE_CARDS.map((card) => [card.id, formatFreshness(card.freshness, BOARD_FIXTURE_GENERATED_AT)]),
    );
    expect(freshness).toMatchObject({
      c2: "Snapshot 41 min ago",
      c3: "Snapshot 1 h ago",
      c4: "Composed 2 d ago",
      c5: "Snapshot 9 min ago",
      c7: "Composed 5 d ago",
      c8: "Snapshot 12 min ago",
      c11: "Fetched 14 min ago",
      c13: "Fetched 14 min ago",
    });
  });

  it("maps absent prototype values to null rather than placeholder text", () => {
    const manual = BOARD_FIXTURE_CARDS.find((card) => card.id === "c4")!;
    expect(manual.source).toEqual({ kind: "manual", key: null });
    expect(manual.externalHostLabel).toBeNull();
    expect(manual.agentNote).toBe("Drafted with agent assistance");

    const unassigned = BOARD_FIXTURE_CARDS.filter((card) => card.owner === null).map((card) => card.id);
    expect(unassigned).toEqual(["c2", "c10"]);
    for (const card of BOARD_FIXTURE_CARDS) {
      expect(card.owner?.displayName).not.toBe("Unassigned");
      expect(card.relevance).not.toBe("");
    }
  });

  it("binds every card to a fixture repository by githubRepoId", () => {
    const ids = new Set(BOARD_FIXTURE_REPOSITORIES.map((repo) => repo.githubRepoId));
    for (const card of BOARD_FIXTURE_CARDS) {
      expect(card.repository).not.toBeNull();
      expect(ids.has(card.repository!.githubRepoId)).toBe(true);
    }
  });

  it("is plain JSON: ISO instants, no functions or class instances", () => {
    expect(JSON.parse(JSON.stringify(BOARD_FIXTURE_CARDS))).toEqual(BOARD_FIXTURE_CARDS);
    for (const card of BOARD_FIXTURE_CARDS) {
      expect(new Date(card.freshness.at).toISOString()).toBe(card.freshness.at);
    }
  });
});
