import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

const NOW = "2026-09-24T12:00:00.000Z";
const nowMs = Date.parse(NOW);
const ago = (ms: number) => new Date(nowMs - ms).toISOString();

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [2 * MINUTE, "2 min ago"],
    [14 * MINUTE, "14 min ago"],
    [1 * HOUR, "1 h ago"],
    [2 * DAY, "2 d ago"],
  ])("formats %d ms elapsed as %s", (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), NOW)).toBe(expected);
  });

  it("floors each unit at its boundaries", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(59 * SECOND), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(1 * MINUTE), NOW)).toBe("1 min ago");
    expect(formatRelativeTime(ago(59 * MINUTE + 59 * SECOND), NOW)).toBe("59 min ago");
    expect(formatRelativeTime(ago(23 * HOUR + 59 * MINUTE), NOW)).toBe("23 h ago");
    expect(formatRelativeTime(ago(1 * DAY), NOW)).toBe("1 d ago");
  });

  it("clamps an instant 40 s after now to just now", () => {
    expect(formatRelativeTime(ago(-40 * SECOND), NOW)).toBe("just now");
  });

  it("accepts now as a Date as well as an ISO string", () => {
    expect(formatRelativeTime(ago(2 * MINUTE), new Date(nowMs))).toBe("2 min ago");
  });

  it("never yields a negative or unparseable duration", () => {
    const inputs = [
      ago(-40 * SECOND),
      ago(-3 * DAY),
      ago(-1),
      "not a date",
      "",
      ago(5 * MINUTE),
      ago(400 * DAY),
    ];
    for (const iso of inputs) {
      for (const now of [NOW, "garbage"]) {
        const text = formatRelativeTime(iso, now);
        expect(text).toMatch(/^(just now|\d+ (min|h|d) ago)$/);
        expect(text).not.toMatch(/-|NaN|Infinity/);
      }
    }
  });
});
