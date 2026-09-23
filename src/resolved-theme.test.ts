// design-system-and-app-shell task 4.2 (design.md Decision 3 and invariant
// sweep, "Resolved theme"): which presentation is showing is decided by the
// CSS cascade in src/app/tokens.css and nowhere else. No script computes or
// holds a resolved theme — no `matchMedia`, no `prefers-color-scheme` query,
// no `resolvedTheme` (or `useResolvedTheme`) — and no other stylesheet adds
// its own `prefers-color-scheme` rule, which would ignore an explicit Light or
// Dark choice. Comments are ignored, so a file may still explain the rule;
// tests are exempt, since they stub these names to prove they go unused.
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { SRC_ROOT, isTestFile, listFiles, readSource, repoPath, stripComments } from "./source-scan.testing";

const THEME_READERS: ReadonlyArray<[string, RegExp]> = [
  ["matchMedia", /matchMedia/],
  ["prefers-color-scheme", /prefers-color-scheme/i],
  ["resolvedTheme", /resolvedTheme/i],
];

const TOKENS_CSS = join(SRC_ROOT, "app", "tokens.css");

/** Each theme reader `source` contains, as "file: term". */
function themeReaders(file: string, source: string): string[] {
  const code = file.endsWith(".css") ? source.replace(/\/\*[\s\S]*?\*\//g, "") : stripComments(source);
  const terms = file.endsWith(".css") ? THEME_READERS.filter(([term]) => term === "prefers-color-scheme") : THEME_READERS;
  return terms.filter(([, pattern]) => pattern.test(code)).map(([term]) => `${repoPath(file)}: ${term}`);
}

describe("resolved theme", () => {
  it("is computed by no script", () => {
    const scripts = listFiles(SRC_ROOT).filter((file) => !isTestFile(file));
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.flatMap((file) => themeReaders(file, readSource(file)))).toEqual([]);
  });

  it("is queried by no stylesheet other than tokens.css", () => {
    const sheets = listFiles(SRC_ROOT, /\.css$/).filter((file) => file !== TOKENS_CSS);
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets.flatMap((file) => themeReaders(file, readSource(file)))).toEqual([]);
    expect(themeReaders(TOKENS_CSS, readSource(TOKENS_CSS))).toEqual(["src/app/tokens.css: prefers-color-scheme"]);
  });

  it.each([
    ["a matchMedia listener", 'const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;', ["matchMedia", "prefers-color-scheme"]],
    ["a resolvedTheme prop", "export function Card({ resolvedTheme }: { resolvedTheme: string }) { return resolvedTheme; }", ["resolvedTheme"]],
    ["a useResolvedTheme hook", "const theme = useResolvedTheme();", ["resolvedTheme"]],
    ["a media-query string", 'const query = "(Prefers-Color-Scheme: dark)";', ["prefers-color-scheme"]],
  ])("fails when a script introduces %s", (_label, line, terms) => {
    const file = join(SRC_ROOT, "app", "components", "example.tsx");
    expect(themeReaders(file, `export const a = 1;\n${line}\n`)).toEqual(terms.map((term) => `src/app/components/example.tsx: ${term}`));
  });

  it("fails when a component stylesheet adds its own dark-mode query", () => {
    const file = join(SRC_ROOT, "app", "components", "example.module.css");
    expect(themeReaders(file, "@media (prefers-color-scheme: dark) { .card { color: white; } }")).toEqual([
      "src/app/components/example.module.css: prefers-color-scheme",
    ]);
  });

  it("does not count a reader named only in a comment", () => {
    expect(themeReaders(join(SRC_ROOT, "app", "x.ts"), "// Nothing here reads matchMedia or resolvedTheme.\nexport {};")).toEqual([]);
    expect(themeReaders(join(SRC_ROOT, "app", "x.css"), "/* resolved via prefers-color-scheme in tokens.css */ .a {}")).toEqual([]);
  });
});
