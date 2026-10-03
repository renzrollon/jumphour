import { describe, expect, it } from "vitest";
import { formatListenerState } from "./listener-text";

const NOW = "2026-09-24T12:00:00.000Z";
const minutesBefore = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

describe("formatListenerState", () => {
  it("not-configured: says so, with no interval line", () => {
    expect(formatListenerState({ status: "not-configured" }, NOW)).toEqual({
      intervalLine: null,
      heardLine: "Listener not configured",
      degraded: false,
    });
  });

  it("never-heard: interval line plus 'Not heard yet'", () => {
    expect(formatListenerState({ status: "never-heard", intervalMinutes: 5 }, NOW)).toEqual({
      intervalLine: "Listening every 5 min",
      heardLine: "Not heard yet",
      degraded: false,
    });
  });

  it("healthy: 'Last heard 2 min ago' against generatedAt", () => {
    expect(formatListenerState({ status: "healthy", intervalMinutes: 5, lastHeardAt: minutesBefore(2) }, NOW)).toEqual({
      intervalLine: "Listening every 5 min",
      heardLine: "Last heard 2 min ago",
      degraded: false,
    });
  });

  it("healthy: a last-heard time after generatedAt reads 'just now', never negative", () => {
    const later = new Date(Date.parse(NOW) + 40_000).toISOString();
    const text = formatListenerState({ status: "healthy", intervalMinutes: 5, lastHeardAt: later }, NOW);
    expect(text.heardLine).toBe("Last heard just now");
  });

  it("delayed and retrying: delayed/retrying wording, last successful listen, degraded", () => {
    const text = formatListenerState(
      { status: "delayed", intervalMinutes: 5, lastSuccessAt: minutesBefore(14), retrying: true },
      NOW,
    );
    expect(text).toEqual({
      intervalLine: "Listening delayed · retrying",
      heardLine: "Last successful listen 14 min ago",
      degraded: true,
    });
  });

  it("delayed without retry or any success: still distinguishable by words", () => {
    expect(
      formatListenerState({ status: "delayed", intervalMinutes: 5, lastSuccessAt: null, retrying: false }, NOW),
    ).toEqual({ intervalLine: "Listening delayed", heardLine: "No successful listen yet", degraded: true });
  });

  it("only the not-configured state omits the interval line", () => {
    const states = [
      { status: "never-heard", intervalMinutes: 5 },
      { status: "healthy", intervalMinutes: 5, lastHeardAt: minutesBefore(1) },
      { status: "delayed", intervalMinutes: 5, lastSuccessAt: minutesBefore(1), retrying: true },
    ] as const;
    for (const s of states) expect(formatListenerState(s, NOW).intervalLine).not.toBeNull();
    expect(formatListenerState({ status: "not-configured" }, NOW).heardLine).not.toMatch(/Listening every|Last heard/);
  });
});
