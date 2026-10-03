// design-system-and-app-shell task 3.2 (specs/design-system/spec.md "Present a
// light and a dark surface system that both meet WCAG AA"): reads the token
// values from tokens.css and measures, in every presentation, each ink, accent,
// tone, and source color against the surfaces it is used on (at least 4.5:1),
// and each control border, the focus indicator, tone dots, and tone icons
// against theirs (at least 3:1). A failure names the presentation, the pair,
// where it is used, the measured ratio, and the floor.
//
// The table lists where each token is actually painted. When a component puts
// a token on a new surface, add the pair here; the coverage case below fails
// when a stylesheet starts using a color or border token the table does not
// measure. `--border` is exempt: it draws dividers and surface outlines, and
// outlines only controls that their own text already identifies (secondary
// buttons, a select showing its value, a labelled switch, the segmented group),
// so it carries nothing that needs 3:1 (WCAG 1.4.11).
//
// fix-control-state-contrast (design.md Decision 4) closes the two ways a color
// could escape the table: the rule pins tie each indicator painted with
// `background`, which the coverage case does not read, to the rule that paints
// it, and the literal-color guard fails any stylesheet that paints a color
// other than a token.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CssRule, parseCssRules, readCss } from "./css-rules.testing";
import { SRC_ROOT, listFiles, readSource, repoPath } from "../source-scan.testing";

type Tokens = ReadonlyMap<string, string>;

interface Pair {
  fg: string;
  bg: string;
  use: string;
}

interface Floor {
  min: number;
  pairs: readonly Pair[];
}

const pair = (fg: string, bg: string, use: string): Pair => ({ fg, bg, use });

const FLOORS: Readonly<Record<string, Floor>> = {
  "body ink": {
    min: 4.5,
    pairs: [
      pair("--ink", "--bg", "page and input text"),
      pair("--ink", "--surface", "card, popover, dialog, and banner text"),
      pair("--ink", "--surface2", "selected segmented option, hovered account trigger and menu item"),
      pair("--ink", "--accentSoft", "dialog busy row"),
    ],
  },
  "secondary ink": {
    min: 4.5,
    pairs: [
      pair("--ink2", "--bg", "field labels, switch label, table metadata"),
      pair("--ink2", "--surface", "dialog descriptions, banner detail, settings copy"),
      pair("--ink2", "--surface2", "unselected segmented options, highlighted menu item descriptions"),
      pair("--ink2", "--surface3", "neutral badge, Manual source badge"),
    ],
  },
  "metadata ink": {
    min: 4.5,
    pairs: [pair("--ink3", "--surface", "popover captions, settings headings, menu item descriptions")],
  },
  "accent ink": {
    min: 4.5,
    pairs: [
      pair("--accentInk", "--accent", "primary button and sign-in link"),
      pair("--accentInk", "--accentHover", "hovered primary button and sign-in link"),
      pair("--accent", "--bg", "links and ghost buttons on the page"),
      pair("--accent", "--surface", "ghost buttons in popovers and dialogs"),
      pair("--accent", "--surface2", "hovered ghost buttons"),
      pair("--accent", "--accentSoft", "accent badge"),
    ],
  },
  "danger ink": {
    min: 4.5,
    pairs: [
      pair("--redInk", "--red", "danger button"),
      pair("--redInk", "--redHover", "hovered danger button"),
    ],
  },
  "semantic tones": {
    min: 4.5,
    pairs: [
      pair("--green", "--greenSoft", "healthy badge"),
      pair("--amber", "--amberSoft", "delayed badge"),
      pair("--red", "--redSoft", "failed badge"),
      pair("--red", "--bg", "field error text on the page"),
      pair("--red", "--surface", "field error text in a dialog"),
    ],
  },
  "source badges": {
    min: 4.5,
    pairs: [
      pair("--ghInk", "--gh", "GitHub source badge"),
      pair("--gl", "--glSoft", "GitLab source badge"),
      pair("--jira", "--jiraSoft", "Jira · MCP source badge"),
    ],
  },
  "control borders": {
    min: 3,
    pairs: [
      pair("--border2", "--bg", "text field and text area border against their fill"),
      pair("--border2", "--surface", "text field and text area border in a dialog"),
      pair("--border2", "--bg", "switch track when off"),
      pair("--accent", "--bg", "switch track when on"),
      pair("--red", "--bg", "invalid field border"),
    ],
  },
  "focus indicator": {
    min: 3,
    pairs: [
      pair("--accent", "--bg", "focus outline on the page"),
      pair("--accent", "--surface", "focus outline in popovers and dialogs"),
      pair("--accent", "--surface2", "focus outline in the segmented group"),
    ],
  },
  "state indicators": {
    min: 3,
    pairs: [
      pair("--surface", "--border2", "switch knob when off"),
      pair("--accentInk", "--accent", "switch knob when on"),
      pair("--border2", "--surface2", "chosen segmented option border against the group"),
      pair("--border2", "--surface", "chosen segmented option border against its fill"),
    ],
  },
  "tone dots": {
    min: 3,
    pairs: [
      pair("--ink3", "--surface3", "neutral badge dot"),
      pair("--green", "--greenSoft", "healthy badge dot"),
      pair("--amber", "--amberSoft", "delayed badge dot"),
      pair("--red", "--redSoft", "failed badge dot"),
      pair("--accent", "--accentSoft", "accent badge dot"),
    ],
  },
  "tone icons": {
    min: 3,
    pairs: [
      pair("--ink3", "--surface", "neutral banner icon and rule"),
      pair("--green", "--surface", "healthy banner icon and rule"),
      pair("--amber", "--surface", "delayed banner icon and rule"),
      pair("--red", "--surface", "failed banner icon and rule"),
    ],
  },
};

/** Color and border tokens that deliberately carry no contrast floor, with the reason. */
const EXEMPT: Readonly<Record<string, string>> = {
  "--border": "dividers, surface outlines, and outlines of controls their own text identifies",
};

/**
 * A declaration a component rule must carry, or properties it must not
 * declare, so a pair in FLOORS is tied to the rule that actually paints it.
 */
interface RulePin {
  file: string;
  selector: string;
  declares?: [string, string];
  forbids?: readonly string[];
}

const UI = "components/ui/";

const RULE_PINS: readonly RulePin[] = [
  // Menu item descriptions stay off --ink3 while the item carries the --surface2 highlight.
  { file: `${UI}transient.module.css`, selector: ".item:hover, .item:focus-visible", declares: ["background", "var(--surface2)"] },
  {
    file: `${UI}transient.module.css`,
    selector: ".item:hover .itemDescription, .item:focus-visible .itemDescription",
    declares: ["color", "var(--ink2)"],
  },
  { file: `${UI}button.module.css`, selector: ".danger", declares: ["color", "var(--redInk)"] },
  { file: `${UI}button.module.css`, selector: ".danger", declares: ["background", "var(--red)"] },
  { file: `${UI}button.module.css`, selector: ".danger:hover:not(:disabled)", declares: ["background", "var(--redHover)"] },
  // A filter dims the label with the fill, to a color no pair can measure.
  { file: `${UI}button.module.css`, selector: ".danger:hover:not(:disabled)", forbids: ["filter"] },
  { file: `${UI}switch.module.css`, selector: ".track", declares: ["background", "var(--border2)"] },
  { file: `${UI}switch.module.css`, selector: ".on", declares: ["background", "var(--accent)"] },
  { file: `${UI}switch.module.css`, selector: ".knob", declares: ["background", "var(--surface)"] },
  { file: `${UI}switch.module.css`, selector: ".on .knob", declares: ["background", "var(--accentInk)"] },
  { file: `${UI}segmented-control.module.css`, selector: ".group", declares: ["background", "var(--surface2)"] },
  { file: `${UI}segmented-control.module.css`, selector: ".option", declares: ["border", "1px solid transparent"] },
  { file: `${UI}segmented-control.module.css`, selector: '.option[aria-checked="true"]', declares: ["border-color", "var(--border2)"] },
  { file: `${UI}segmented-control.module.css`, selector: '.option[aria-checked="true"]', declares: ["background", "var(--surface)"] },
  // Choosing an option must not resize it or move its neighbours.
  {
    file: `${UI}segmented-control.module.css`,
    selector: '.option[aria-checked="true"]',
    forbids: ["border", "border-width", "padding", "font-weight", "min-width", "height"],
  },
];

/** Every pin its stylesheet breaks, as a sentence naming the file, the selector, and the declaration. */
function pinFailures(pins: readonly RulePin[]): string[] {
  return pins.flatMap(({ file, selector, declares, forbids = [] }) => {
    const path = join(SRC_ROOT, "app", file);
    const declarations = parseCssRules(readSource(path))
      .filter((rule) => rule.atRules.length === 0 && rule.selector === selector)
      .flatMap((rule) => rule.declarations);
    const where = `${repoPath(path)} ${selector}`;
    const failures: string[] = [];
    if (declares) {
      const [property, value] = declares;
      const found = declarations.filter(([p]) => p === property).map(([, v]) => v);
      if (!found.includes(value)) {
        const actual = found.length ? `declares ${property}: ${found.join("; ")}` : `declares no ${property}`;
        failures.push(`${where} must declare ${property}: ${value}, but ${actual}`);
      }
    }
    for (const property of forbids) {
      if (declarations.some(([p]) => p === property)) failures.push(`${where} must not declare ${property}`);
    }
    return failures;
  });
}

/** Properties that can paint a color, besides every border* and outline* one below. */
const PAINT_PROPERTIES = new Set([
  "color", "background", "background-color", "background-image", "box-shadow",
  "fill", "stroke", "caret-color", "accent-color",
]);

/** border* and outline* properties that only set geometry or style. */
const GEOMETRY_PROPERTIES = new Set([
  "border-radius", "border-width", "border-style", "border-collapse", "border-spacing",
  "outline-offset", "outline-width", "outline-style",
]);

/** What may remain of a painting value once tokens and numbers are removed. Fail-closed: add a keyword on purpose. */
const PAINT_KEYWORDS = new Set([
  "transparent", "currentcolor", "inherit", "initial", "unset", "none",
  "solid", "dashed", "dotted", "double", "inset", "underline",
]);

/** Rules the literal-color guard skips, with the reason. */
const LITERAL_EXEMPT: ReadonlyArray<{ reason: string; applies: (path: string, rule: CssRule) => boolean }> = [
  {
    reason: "the modal scrim dims the page behind a dialog and carries no content, so it has no pair",
    applies: (path, rule) =>
      path === "src/app/components/ui/modal.module.css" && rule.selector === ".backdropCenter, .backdropRight",
  },
  {
    reason: "under forced colors, system colors such as CanvasText are the correct choice",
    applies: (_path, rule) => rule.atRules.includes("@media (forced-colors: active)"),
  },
];

const paints = (property: string) =>
  PAINT_PROPERTIES.has(property) ||
  ((property.startsWith("border") || property.startsWith("outline")) && !GEOMETRY_PROPERTIES.has(property)) ||
  property.startsWith("text-decoration") ||
  property.startsWith("column-rule");

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[a-z]+|%)?$/i;

/** Every declaration in `css` that paints a color other than a token or an allowed keyword, as a sentence naming it. */
function literalColors(path: string, css: string): string[] {
  return parseCssRules(css)
    .filter((rule) => !LITERAL_EXEMPT.some(({ applies }) => applies(path, rule)))
    .flatMap((rule) =>
      rule.declarations
        .filter(([property]) => paints(property))
        .filter(([, value]) =>
          value
            .replace(/var\(\s*--[\w-]+\s*\)/g, " ")
            .split(/[\s,/]+/)
            .some((word) => word !== "" && !NUMBER.test(word) && !PAINT_KEYWORDS.has(word.toLowerCase())),
        )
        .map(([property, value]) => `${path} ${rule.selector} { ${property}: ${value} } paints a color outside the token set`),
    );
}

const rules = parseCssRules(readCss(new URL("./tokens.css", import.meta.url)));
const tokenMap = (rule: CssRule | undefined): Tokens =>
  new Map((rule?.declarations ?? []).filter(([property]) => property.startsWith("--")));

const PRESENTATIONS: ReadonlyArray<[string, Tokens]> = [
  ["light", tokenMap(rules.find((r) => r.atRules.length === 0 && r.selector === ":root" && r.declarations.some(([p]) => p === "--bg")))],
  ["dark", tokenMap(rules.find((r) => r.atRules.length === 0 && r.selector === ':root[data-jh-theme="dark"]'))],
  ["dark (system)", tokenMap(rules.find((r) => r.atRules[0] === "@media (prefers-color-scheme: dark)"))],
];

function srgb(hex: string): [number, number, number] | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return undefined;
  const digits = match[1]!.length === 3 ? [...match[1]!].map((d) => d + d).join("") : match[1]!;
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Every pair below its floor in `tokens`, as a sentence naming it. */
function contrastFailures(presentation: string, tokens: Tokens): string[] {
  const failures: string[] = [];
  for (const [category, { min, pairs }] of Object.entries(FLOORS)) {
    for (const { fg, bg, use } of pairs) {
      const [fgColor, bgColor] = [srgb(tokens.get(fg) ?? ""), srgb(tokens.get(bg) ?? "")];
      const label = `${presentation}: ${fg} on ${bg} (${category}, ${use})`;
      if (!fgColor || !bgColor) {
        failures.push(`${label} is not a pair of solid colors: ${tokens.get(fg)} on ${tokens.get(bg)}`);
        continue;
      }
      const ratio = contrast(fgColor, bgColor);
      if (ratio < min) failures.push(`${label} = ${(Math.floor(ratio * 100) / 100).toFixed(2)}:1, needs ${min}:1`);
    }
  }
  return failures;
}

describe("token contrast", () => {
  it.each(PRESENTATIONS)("reads the %s presentation from tokens.css", (_name, tokens) => {
    expect(tokens.get("--bg")).toMatch(/^#/);
    expect(tokens.get("--ink")).toMatch(/^#/);
  });

  it.each(PRESENTATIONS)("clears every floor in the %s presentation", (name, tokens) => {
    expect(contrastFailures(name, tokens)).toEqual([]);
  });

  it("names the failing pair when a value is changed below the floor", () => {
    const light = new Map(PRESENTATIONS[0]![1]);
    light.set("--ink3", "#a19d94");
    light.set("--border2", "#e2dfd7");
    expect(contrastFailures("light", light)).toEqual([
      "light: --ink3 on --surface (metadata ink, popover captions, settings headings, menu item descriptions) = 2.70:1, needs 4.5:1",
      "light: --border2 on --bg (control borders, text field and text area border against their fill) = 1.24:1, needs 3:1",
      "light: --border2 on --surface (control borders, text field and text area border in a dialog) = 1.33:1, needs 3:1",
      "light: --border2 on --bg (control borders, switch track when off) = 1.24:1, needs 3:1",
      "light: --surface on --border2 (state indicators, switch knob when off) = 1.33:1, needs 3:1",
      "light: --border2 on --surface2 (state indicators, chosen segmented option border against the group) = 1.15:1, needs 3:1",
      "light: --border2 on --surface (state indicators, chosen segmented option border against its fill) = 1.33:1, needs 3:1",
      "light: --ink3 on --surface3 (tone dots, neutral badge dot) = 2.16:1, needs 3:1",
      "light: --ink3 on --surface (tone icons, neutral banner icon and rule) = 2.70:1, needs 3:1",
    ]);
  });

  it("refuses a token that is not a solid color rather than skipping it", () => {
    const dark = new Map(PRESENTATIONS[1]![1]);
    dark.set("--gh", "var(--ink)");
    expect(contrastFailures("dark", dark)).toEqual([
      "dark: --ghInk on --gh (source badges, GitHub source badge) is not a pair of solid colors: #111111 on var(--ink)",
    ]);
  });

  it("names the chosen segmented option when its border falls to the divider color", () => {
    const dark = new Map(PRESENTATIONS[1]![1]);
    dark.set("--border2", "#2f2f2a");
    expect(contrastFailures("dark", dark)).toContain(
      "dark: --border2 on --surface2 (state indicators, chosen segmented option border against the group) = 1.15:1, needs 3:1",
    );
  });

  it("names both danger-ink pairs when the dark danger label is white", () => {
    const dark = new Map(PRESENTATIONS[1]![1]);
    dark.set("--redInk", "#ffffff");
    expect(contrastFailures("dark", dark)).toEqual([
      "dark: --redInk on --red (danger ink, danger button) = 2.42:1, needs 4.5:1",
      "dark: --redInk on --redHover (danger ink, hovered danger button) = 2.01:1, needs 4.5:1",
    ]);
  });

  it("ties each measured indicator to the rule that paints it", () => {
    expect(pinFailures(RULE_PINS)).toEqual([]);
  });

  it("measures every token a stylesheet uses for text, icon, border, or outline color", () => {
    const measured = new Set([
      ...Object.values(FLOORS).flatMap(({ pairs }) => pairs.map(({ fg }) => fg)),
      ...Object.keys(EXEMPT),
    ]);
    const unmeasured = listFiles(SRC_ROOT, /\.css$/)
      .filter((file) => !file.endsWith("tokens.css"))
      .flatMap((file) =>
        parseCssRules(readSource(file)).flatMap((rule) =>
          rule.declarations
            .filter(([property]) => property === "color" || property.startsWith("border") || property.startsWith("outline"))
            .flatMap(([, value]) => [...value.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]!))
            .filter((token) => !measured.has(token))
            .map((token) => `${repoPath(file)} ${rule.selector}: ${token}`),
        ),
      );
    expect(unmeasured).toEqual([]);
  });
});

describe("literal-color guard", () => {
  it("names each rule that paints a literal color", () => {
    const css = ".x { color: #ffffff } .y { background: white } .z { border: 1px solid rgb(0 0 0) }";
    expect(literalColors("in-memory.css", css)).toEqual([
      "in-memory.css .x { color: #ffffff } paints a color outside the token set",
      "in-memory.css .y { background: white } paints a color outside the token set",
      "in-memory.css .z { border: 1px solid rgb(0 0 0) } paints a color outside the token set",
    ]);
  });

  it("passes the same rules painted with a token", () => {
    const css = ".x { color: var(--ink) } .y { background: var(--ink) } .z { border: 1px solid var(--ink) }";
    expect(literalColors("in-memory.css", css)).toEqual([]);
  });

  it("fails closed on a keyword it does not know", () => {
    const css = ".u { text-decoration: underline } .w { text-decoration: wavy underline }";
    expect(literalColors("in-memory.css", css)).toEqual([
      "in-memory.css .w { text-decoration: wavy underline } paints a color outside the token set",
    ]);
  });

  it("leaves system colors under forced colors alone", () => {
    const css = "@media (forced-colors: active) { .b { border-color: CanvasText } }";
    expect(literalColors("in-memory.css", css)).toEqual([]);
  });

  it("finds no literal color in any stylesheet under src/", () => {
    const failures = listFiles(SRC_ROOT, /\.css$/)
      .filter((file) => !file.endsWith("tokens.css"))
      .flatMap((file) => literalColors(repoPath(file), readSource(file)));
    expect(failures).toEqual([]);
  });
});
