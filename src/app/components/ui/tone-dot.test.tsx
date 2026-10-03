// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ToneDot, type Tone } from "./tone-dot";

afterEach(() => {
  cleanup();
});

const TONES: readonly Tone[] = ["neutral", "ok", "warn", "bad", "accent"];

describe("ToneDot", () => {
  it.each(TONES)("hides the %s tone dot from assistive technology", (tone) => {
    const { container } = render(<ToneDot tone={tone} />);
    const dot = container.firstElementChild;
    expect(dot).not.toBeNull();
    expect(dot?.tagName).toBe("SPAN");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});
