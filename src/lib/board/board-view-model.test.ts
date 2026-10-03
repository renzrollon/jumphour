import { describe, expect, it } from "vitest";
import type { BoardViewModel, LaneId, LaneViewModel } from "./board-view-model";

function lane(id: LaneId): LaneViewModel {
  return { id, listener: { status: "not-configured" }, manualRead: null, cards: [] };
}

const unavailable = { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." } as const;

describe("BoardViewModel", () => {
  it("accepts exactly four lanes and survives a JSON round trip unchanged", () => {
    const view: BoardViewModel = {
      generatedAt: "2026-09-24T12:00:00.000Z",
      installation: { installationId: 1, accountLogin: "acme" },
      repositories: [{ githubRepoId: 42, fullName: "acme/web" }],
      lanes: [lane("idea"), lane("openspec-change"), lane("in-progress"), lane("pr-mr")],
      compose: unavailable,
    };
    expect(view.lanes).toHaveLength(4);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("rejects a three-lane tuple at the type level", () => {
    const view: BoardViewModel = {
      generatedAt: "2026-09-24T12:00:00.000Z",
      installation: null,
      repositories: [],
      // @ts-expect-error — `lanes` is a fixed 4-tuple; three lanes must not type-check.
      lanes: [lane("idea"), lane("openspec-change"), lane("in-progress")],
      compose: unavailable,
    };
    expect(view.lanes).toHaveLength(3);
  });

  it("rejects a five-lane tuple and an unknown lane id at the type level", () => {
    // @ts-expect-error — a fifth lane must not type-check.
    const five: BoardViewModel["lanes"] = [
      lane("idea"),
      lane("openspec-change"),
      lane("in-progress"),
      lane("pr-mr"),
      lane("pr-mr"),
    ];
    // @ts-expect-error — "done" is not a lane id.
    const unknown: LaneId = "done";
    expect(five).toHaveLength(5);
    expect(unknown).toBe("done");
  });
});
