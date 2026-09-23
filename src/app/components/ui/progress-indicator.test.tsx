// @vitest-environment jsdom
// Task 5.7: the in-progress indicator keeps a static, text-accompanied
// presentation under reduced motion — the work is still announced and its
// text still visible while the spinner's animation is suppressed.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { parseCssRules } from "../../css-rules.testing";
import { ProgressIndicator } from "./progress-indicator";

afterEach(() => {
  cleanup();
});

const REDUCED = "@media (prefers-reduced-motion: reduce)";
const css = parseCssRules(readFileSync(join(import.meta.dirname, "progress-indicator.module.css"), "utf8"));
const globals = parseCssRules(readFileSync(join(import.meta.dirname, "../../globals.css"), "utf8"));

describe("ProgressIndicator", () => {
  it("announces the work in progress through a busy status carrying its visible text", () => {
    render(<ProgressIndicator label="Checking repository access…" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Checking repository access…");
    expect(status.getAttribute("aria-busy")).toBe("true");
    const text = screen.getByText("Checking repository access…");
    expect(status.contains(text)).toBe(true);
    expect(text.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("hides only the spinner from assistive technology", () => {
    const { container } = render(<ProgressIndicator label="Working…" />);
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
    for (const el of hidden) {
      expect(el.textContent).toBe("");
      expect(el.tagName === "svg" || el.querySelector("svg") !== null).toBe(true);
    }
  });

  it("suppresses the spinner's animation under reduced motion and keeps everything visible", () => {
    const reduced = css.filter((rule) => rule.atRules.includes(REDUCED));
    expect(reduced).toHaveLength(1);
    expect(reduced[0]!.selector).toBe(".spinner, .spinner *");
    expect(reduced[0]!.declarations).toEqual([["animation", "none"]]);
    // The global rule backs it for every element, including the icon's own class.
    const global = globals.filter((rule) => rule.atRules.includes(REDUCED));
    expect(global.some((rule) => rule.declarations.some(([p, v]) => p === "animation" && v.startsWith("none")))).toBe(
      true,
    );
    for (const rule of reduced) {
      for (const [prop, value] of rule.declarations) {
        expect(`${prop}: ${value}`).not.toMatch(/display: none|visibility: hidden|opacity: 0$/);
      }
    }
  });
});
