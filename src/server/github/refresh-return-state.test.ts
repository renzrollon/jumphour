// Task 8.4: the OAuth `state` round-trip marker that lets a Refresh survive
// the trip through GitHub's authorize endpoint — see
// ./refresh-return-state.ts for why the trip is necessary at all.
import { describe, expect, it } from "vitest";
import { REFRESH_RETURN_PATH, decodeRefreshState, encodeRefreshState } from "./refresh-return-state";

describe("encodeRefreshState / decodeRefreshState", () => {
  it("round-trips the installation that was current when Refresh was clicked", () => {
    expect(decodeRefreshState(encodeRefreshState(42))).toEqual({ intent: "refresh", installationId: 42 });
  });

  it("treats an ordinary sign-in (no state) as not a refresh", () => {
    expect(decodeRefreshState(null)).toBeNull();
    expect(decodeRefreshState(undefined)).toBeNull();
    expect(decodeRefreshState("")).toBeNull();
  });

  it("treats an unrelated state value as not a refresh", () => {
    expect(decodeRefreshState("some-csrf-nonce")).toBeNull();
    expect(decodeRefreshState("signin:42")).toBeNull();
  });

  it("rejects a refresh marker whose installation id is missing or not a number", () => {
    expect(decodeRefreshState("refresh")).toBeNull();
    expect(decodeRefreshState("refresh:")).toBeNull();
    expect(decodeRefreshState("refresh:abc")).toBeNull();
    expect(decodeRefreshState("refresh:-1")).toBeNull();
    expect(decodeRefreshState("refresh:0")).toBeNull();
    expect(decodeRefreshState("refresh:1.5")).toBeNull();
  });

  it("ignores extra trailing segments, so a CSRF nonce can be added later without breaking this reader", () => {
    expect(decodeRefreshState("refresh:42:a-future-nonce")).toEqual({ intent: "refresh", installationId: 42 });
  });
});

describe("REFRESH_RETURN_PATH", () => {
  // workflow-board-ui task 6.4: Refresh returns to the repository and
  // discovery view, not the board at `/`.
  it("is the repository and discovery view", () => {
    expect(REFRESH_RETURN_PATH).toBe("/repositories");
  });
});
