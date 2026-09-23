// Task 3.1: tokens.css keeps the prototype's token names and values (design.md
// Decision 1) and resolves the presentation by the cascade alone (Decision 3):
// light on bare :root, dark under both the OS media query (unless explicitly
// light) and the explicit data-jh-theme="dark" stamp.
import { describe, expect, it } from "vitest";
import { type CssRule, parseCssRules, readCss } from "./css-rules.testing";

const rules = parseCssRules(readCss(new URL("./tokens.css", import.meta.url)));

const tokenNames = (rule: CssRule) => rule.declarations.map(([p]) => p).filter((p) => p.startsWith("--"));
const tokenMap = (rule: CssRule) => new Map(rule.declarations.filter(([p]) => p.startsWith("--")));

const FONT_TOKENS = ["--fontMono", "--fontSans"];

const PROTOTYPE_TOKENS = [
  "--bg", "--surface", "--surface2", "--surface3", "--border", "--border2",
  "--ink", "--ink2", "--ink3", "--accent", "--accentHover", "--accentSoft", "--accentInk",
  "--green", "--greenSoft", "--amber", "--amberSoft", "--red", "--redSoft",
  "--shadow", "--shadowLg", "--term", "--termInk", "--gh", "--ghInk",
  "--gl", "--glSoft", "--jira", "--jiraSoft", "--skeleton",
];

// Tokens Jumphour adds beyond the prototype, listed apart so PROTOTYPE_TOKENS
// stays the prototype's names verbatim (fix-control-state-contrast design.md
// Decision 5).
const JUMPHOUR_TOKENS = ["--redInk", "--redHover"];

const bareRoot = rules.filter((r) => r.atRules.length === 0 && r.selector === ":root");
const fontBlock = bareRoot.find((r) => tokenNames(r).includes("--fontSans"));
const light = bareRoot.find((r) => tokenNames(r).includes("--bg"));
const mediaDark = rules.find(
  (r) =>
    r.atRules.length === 1 &&
    r.atRules[0] === "@media (prefers-color-scheme: dark)" &&
    r.selector === ':root:not([data-jh-theme="light"])',
);
const explicitDark = rules.find((r) => r.atRules.length === 0 && r.selector === ':root[data-jh-theme="dark"]');

describe("tokens.css", () => {
  it("has the light block on bare :root and both dark blocks", () => {
    expect(light).toBeDefined();
    expect(mediaDark).toBeDefined();
    expect(explicitDark).toBeDefined();
  });

  it("defines exactly the prototype token names and Jumphour's additions in the light presentation", () => {
    const names = tokenNames(light!);
    const expected = [...PROTOTYPE_TOKENS, ...JUMPHOUR_TOKENS];
    const missing = expected.filter((n) => !names.includes(n));
    const extra = names.filter((n) => !expected.includes(n));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("never lists a Jumphour addition that redefines a prototype name", () => {
    expect(JUMPHOUR_TOKENS.filter((n) => PROTOTYPE_TOKENS.includes(n))).toEqual([]);
  });

  it("defines exactly the same token-name set in both dark blocks as in :root", () => {
    const rootNames = new Set(bareRoot.flatMap(tokenNames).filter((n) => !FONT_TOKENS.includes(n)));
    for (const dark of [mediaDark!, explicitDark!]) {
      const darkNames = new Set(tokenNames(dark));
      const onlyInRoot = [...rootNames].filter((n) => !darkNames.has(n));
      const onlyInDark = [...darkNames].filter((n) => !rootNames.has(n));
      expect({ onlyInRoot, onlyInDark }).toEqual({ onlyInRoot: [], onlyInDark: [] });
      expect(tokenNames(dark)).toHaveLength(darkNames.size);
    }
  });

  it("defines no token only in one presentation or twice in one block", () => {
    const all = [light!, mediaDark!, explicitDark!];
    for (const rule of all) expect(new Set(tokenNames(rule)).size).toBe(tokenNames(rule).length);
    const union = new Set(all.flatMap(tokenNames));
    for (const name of union) {
      for (const rule of all) expect(tokenNames(rule), `${name} in ${rule.selector}`).toContain(name);
    }
  });

  it("gives the two dark blocks identical values", () => {
    expect(tokenMap(mediaDark!)).toEqual(tokenMap(explicitDark!));
  });

  it("carries the prototype's values verbatim for a sample of tokens", () => {
    const l = tokenMap(light!);
    const d = tokenMap(explicitDark!);
    expect(l.get("--bg")).toBe("#f8f7f4");
    expect(l.get("--accent")).toBe("#4338ca");
    expect(l.get("--ink3")).toBe("#77736a");
    expect(d.get("--bg")).toBe("#141412");
    expect(d.get("--accent")).toBe("#a5a0f5");
    expect(d.get("--gh")).toBe("#e6e6e6");
    expect(d.get("--skeleton")).toBe("linear-gradient(90deg, #242421 25%, #2c2c28 50%, #242421 75%)");
  });

  it("reads the fonts from the fonts.ts variables with fallback stacks, independent of presentation", () => {
    const fonts = tokenMap(fontBlock!);
    expect(fonts.get("--fontSans")).toBe("var(--font-instrument-sans), system-ui, sans-serif");
    expect(fonts.get("--fontMono")).toBe("var(--font-jetbrains-mono), ui-monospace, monospace");
    for (const rule of rules.filter((r) => r !== fontBlock)) {
      for (const font of FONT_TOKENS) expect(tokenNames(rule)).not.toContain(font);
    }
  });

  it("uses no other selectors, so nothing else can override a presentation", () => {
    const selectors = rules.map((r) => [...r.atRules, r.selector].join(" "));
    expect(new Set(selectors)).toEqual(
      new Set([
        ":root",
        '@media (prefers-color-scheme: dark) :root:not([data-jh-theme="light"])',
        ':root[data-jh-theme="dark"]',
      ]),
    );
  });
});
