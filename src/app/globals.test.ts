// Task 3.3: globals.css carries the reset, base families bound to the font
// tokens, link and :focus-visible defaults, reduced-motion suppression, and a
// coarse-pointer 44px activation-area floor that never changes the drawn size.
import { describe, expect, it } from "vitest";
import { type CssRule, parseCssRules, readCss } from "./css-rules.testing";

const rules = parseCssRules(readCss(new URL("./globals.css", import.meta.url)));

const decl = (rule: CssRule | undefined) => new Map(rule?.declarations ?? []);
const selectorsOf = (rule: CssRule) => rule.selector.split(/\s*,\s*/);
/** A synthetic rule merging every top-level rule whose selector list names `selector`. */
const topLevel = (selector: string): CssRule => ({
  atRules: [],
  selector,
  declarations: rules
    .filter((r) => r.atRules.length === 0 && selectorsOf(r).includes(selector))
    .flatMap((r) => r.declarations),
});
const CONTROL_SELECTOR = /^(\*|button|a|a\[href\]|input|select|textarea|summary|\[role=.*\])(:[\w-]+)?$/;
const inMedia = (media: string) => rules.filter((r) => r.atRules.includes(media));

const COARSE = "@media (pointer: coarse)";
const REDUCED = "@media (prefers-reduced-motion: reduce)";
const SIZE_PROPERTIES =
  /^(width|height|min-width|min-height|max-width|max-height|inline-size|block-size|min-inline-size|min-block-size|padding.*|margin.*|border(-width)?|font-size|line-height|inset.*|flex.*)$/;

describe("globals.css", () => {
  it("applies a border-box reset to every element and pseudo-element", () => {
    const reset = rules.find((r) => r.atRules.length === 0 && r.selector === "*, *::before, *::after");
    expect(decl(reset).get("box-sizing")).toBe("border-box");
  });

  it("binds the base sans and mono families to the font tokens", () => {
    expect(decl(topLevel("body")).get("font-family")).toBe("var(--fontSans)");
    for (const el of ["code", "kbd", "samp", "pre"]) {
      expect(decl(topLevel(el)).get("font-family")).toBe("var(--fontMono)");
    }
  });

  it("gives links and :focus-visible defaults with an offset outline", () => {
    expect(decl(topLevel("a")).get("color")).toBe("var(--accent)");
    expect(decl(topLevel("a:hover")).get("text-decoration")).toBe("underline");
    const focus = decl(topLevel(":focus-visible"));
    expect(focus.get("outline")).toBe("2px solid var(--accent)");
    expect(focus.get("outline-offset")).toBe("2px");
    expect(Number.parseFloat(focus.get("outline-offset")!)).toBeGreaterThan(0);
  });

  it("neutralizes animation and transition under prefers-reduced-motion: reduce", () => {
    const reduced = inMedia(REDUCED);
    expect(reduced).toHaveLength(1);
    expect(reduced[0]!.selector).toBe("*, *::before, *::after");
    const d = decl(reduced[0]);
    expect(d.get("animation")).toBe("none !important");
    expect(d.get("transition")).toBe("none !important");
  });

  it("gives interactive controls a 44px minimum activation area on coarse pointers", () => {
    const coarse = inMedia(COARSE);
    const area = coarse.find((r) => r.selector.endsWith("::after"));
    expect(area).toBeDefined();
    for (const control of ["button", 'a[href]', '[role="button"]', '[role="switch"]', '[role="radio"]', '[role="menuitem"]']) {
      expect(area!.selector).toContain(control);
    }
    const d = decl(area);
    expect(d.get("content")).toBe('""');
    expect(d.get("position")).toBe("absolute");
    expect(d.get("width")).toBe("max(100%, 44px)");
    expect(d.get("height")).toBe("max(100%, 44px)");
    expect(d.get("transform")).toBe("translate(-50%, -50%)");
  });

  it("does not alter the drawn size: the coarse rule only adds an out-of-flow pseudo-element", () => {
    const coarse = inMedia(COARSE);
    for (const rule of coarse) {
      expect(rule.atRules).toEqual([COARSE]);
      if (rule.selector.endsWith("::after")) continue;
      // The control itself only becomes a containing block; nothing that sizes its box.
      expect(rule.declarations.map(([p]) => p)).toEqual(["position"]);
      expect(decl(rule).get("position")).toBe("relative");
    }
  });

  it("sets no control sizing outside the coarse-pointer block, so fine pointers keep compact sizes", () => {
    const controlRules = rules.filter(
      (r) => !r.atRules.includes(COARSE) && selectorsOf(r).some((sel) => CONTROL_SELECTOR.test(sel)),
    );
    expect(controlRules.length).toBeGreaterThan(0);
    for (const rule of controlRules) {
      for (const [property] of rule.declarations) {
        expect(property, `${rule.selector} { ${property} }`).not.toMatch(SIZE_PROPERTIES);
      }
    }
    expect(rules.filter((r) => r.selector.includes("44px") || r.declarations.some(([, v]) => v.includes("44px"))).every((r) => r.atRules.includes(COARSE))).toBe(true);
  });
});
