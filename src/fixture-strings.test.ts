// design-system-and-app-shell task 11.3 (design.md Decision 8's honesty rule):
// the Claude Design prototype's sample identities — the workspace
// `Platform delivery`, the account `Priya Nair`, and the `acme/` sample
// repositories — live only in src/app/dev/ui/fixtures/ and in tests. A
// production module that contains one could render an invented identity where
// a stored row belongs. Comments are ignored, so a module may still explain
// the rule by naming them.
import { describe, expect, it } from "vitest";
import { join, sep } from "node:path";
import { SRC_ROOT, isTestFile, listFiles, readSource, repoPath, stripComments } from "./source-scan.testing";

const FIXTURE_STRINGS: ReadonlyArray<[string, RegExp]> = [
  ["Platform delivery", /platform\s+delivery/i],
  ["Priya Nair", /priya\s+nair/i],
  ["acme/", /\bacme\//i],
];

const FIXTURES_ROOT = join(SRC_ROOT, "app", "dev", "ui", "fixtures") + sep;

const isAllowed = (file: string) => file.startsWith(FIXTURES_ROOT) || isTestFile(file);

/** Each fixture string `source` contains in code, as "file: string". */
function fixtureStrings(file: string, source: string): string[] {
  if (isAllowed(file)) return [];
  const code = stripComments(source);
  return FIXTURE_STRINGS.filter(([, pattern]) => pattern.test(code)).map(([name]) => `${repoPath(file)}: ${name}`);
}

describe("prototype fixture strings", () => {
  it("are defined in the preview fixtures", () => {
    const fixtures = listFiles(FIXTURES_ROOT).map(readSource).join("\n");
    expect(fixtures).toContain("Platform delivery");
    expect(fixtures).toContain("Priya Nair");
  });

  it("appear in no production module", () => {
    const modules = listFiles(SRC_ROOT);
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.flatMap((file) => fixtureStrings(file, readSource(file)))).toEqual([]);
  });

  it.each([
    ["a shell module", join(SRC_ROOT, "app", "components", "shell", "workspace.ts"), 'export const FALLBACK = "Platform delivery";', "Platform delivery"],
    ["a page module", join(SRC_ROOT, "app", "page.tsx"), "export const x = <p>Signed in as Priya Nair</p>;", "Priya Nair"],
    ["a server module", join(SRC_ROOT, "server", "github", "demo.ts"), "export const repo = `acme/${name}`;", "acme/"],
    ["a preview page outside fixtures", join(SRC_ROOT, "app", "dev", "ui", "page.tsx"), "const who = 'priya nair';", "Priya Nair"],
  ])("fails when a fixture name is pasted into %s", (_label, file, source, name) => {
    expect(fixtureStrings(file, source)).toEqual([`${repoPath(file)}: ${name}`]);
  });

  it("allows the fixtures, tests, and comments that name them", () => {
    expect(fixtureStrings(join(FIXTURES_ROOT, "board.ts"), 'export const REPO = "acme/api-gateway";')).toEqual([]);
    expect(fixtureStrings(join(SRC_ROOT, "app", "page.test.tsx"), 'expect(html).toContain("acme/api-gateway");')).toEqual([]);
    expect(fixtureStrings(join(SRC_ROOT, "app", "page.tsx"), "// never render Priya Nair or acme/api-gateway\nexport {};")).toEqual([]);
  });
});
