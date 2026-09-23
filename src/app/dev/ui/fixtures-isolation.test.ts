// Task 10.5 (design.md Decisions 8 and 9): fixture data never reaches a
// production surface. No module outside src/app/dev/ui/ — nothing under
// src/server/, no production route, page, or layout, and no component or
// library they use — imports src/app/dev/ui/fixtures, directly or through
// another module (a production page importing the preview gallery would reach
// the fixtures through it). Preview pages and tests may import fixtures.
import { describe, expect, it } from "vitest";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SRC_ROOT,
  isTestFile,
  listFiles,
  moduleSpecifiers,
  readSource,
  repoPath,
  resolveRelative,
} from "../../../source-scan.testing";

const PREVIEW_ROOT = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_ROOT = join(PREVIEW_ROOT, "fixtures") + sep;

const isFixture = (file: string) => file.startsWith(FIXTURES_ROOT);
const isProduction = (file: string) => !file.startsWith(PREVIEW_ROOT) && !isTestFile(file);

/**
 * Every production module whose imports reach a fixture, as an import chain
 * ending at the fixture. `modules` maps each file to its source.
 */
function fixtureReach(modules: ReadonlyMap<string, string>): string[] {
  const imports = new Map<string, string[]>();
  for (const [file, source] of modules) {
    imports.set(
      file,
      moduleSpecifiers(source).flatMap((specifier) => {
        if (/(?:^|\/)dev\/ui\/fixtures(?:\/|$)/.test(specifier) && !specifier.startsWith(".")) {
          return [join(FIXTURES_ROOT, specifier.replace(/^.*dev\/ui\/fixtures\/?/, "") || "(index)")];
        }
        const target = resolveRelative(file, specifier, (path) => modules.has(path));
        return target ? [target] : [];
      }),
    );
  }

  const chains: string[] = [];
  for (const entry of [...modules.keys()].filter(isProduction)) {
    const parent = new Map<string, string | null>([[entry, null]]);
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.shift()!;
      if (isFixture(file)) {
        const chain: string[] = [];
        for (let at: string | null = file; at !== null; at = parent.get(at)!) chain.unshift(repoPath(at));
        chains.push(chain.join(" -> "));
        break;
      }
      for (const next of imports.get(file) ?? []) {
        if (!parent.has(next)) {
          parent.set(next, file);
          queue.push(next);
        }
      }
    }
  }
  return chains.sort();
}

function sourceTree(): Map<string, string> {
  return new Map(listFiles(SRC_ROOT).map((file) => [file, readSource(file)]));
}

const at = (...parts: string[]) => join(SRC_ROOT, ...parts);

describe("preview fixture isolation", () => {
  it("scans the fixtures and the preview modules that legitimately import them", () => {
    const tree = sourceTree();
    expect([...tree.keys()].some(isFixture)).toBe(true);
    expect(moduleSpecifiers(tree.get(at("app", "dev", "ui", "page.tsx"))!)).toContain("./fixtures/shell");
  });

  it("is reached by no module under src/server and no production route, page, or component", () => {
    expect(fixtureReach(sourceTree())).toEqual([]);
  });

  describe("fails when a production module reaches a fixture", () => {
    const fixture = at("app", "dev", "ui", "fixtures", "shell.ts");
    const gallery = at("app", "dev", "ui", "primitives-gallery.tsx");
    const base = (): Map<string, string> =>
      new Map([
        [fixture, 'export const PREVIEW_ACCOUNT_LOGIN = "Priya Nair";'],
        [gallery, 'import { PREVIEW_ACCOUNT_LOGIN } from "./fixtures/shell";'],
        [at("app", "dev", "ui", "page.tsx"), 'import { PREVIEW_ACCOUNT } from "./fixtures/shell";'],
        [at("app", "page.test.tsx"), 'import { PREVIEW_ACCOUNT } from "./dev/ui/fixtures/shell";'],
      ]);

    it("accepts preview pages and tests importing fixtures", () => {
      expect(fixtureReach(base())).toEqual([]);
    });

    it.each([
      [
        "a server module importing a fixture directly",
        at("server", "board", "provider.ts"),
        'import { PREVIEW_ACCOUNT } from "../../app/dev/ui/fixtures/shell";',
        "src/server/board/provider.ts -> src/app/dev/ui/fixtures/shell.ts",
      ],
      [
        "a production page importing the preview gallery",
        at("app", "repositories", "page.tsx"),
        'import { PrimitivesGallery } from "../dev/ui/primitives-gallery";',
        "src/app/repositories/page.tsx -> src/app/dev/ui/primitives-gallery.tsx -> src/app/dev/ui/fixtures/shell.ts",
      ],
      [
        "a route re-exporting a fixture",
        at("app", "api", "demo", "route.ts"),
        'export { PREVIEW_ACCOUNT_LOGIN } from "../../dev/ui/fixtures/shell";',
        "src/app/api/demo/route.ts -> src/app/dev/ui/fixtures/shell.ts",
      ],
      [
        "a component importing a fixture dynamically",
        at("app", "components", "shell", "account.ts"),
        'const fixtures = await import("../../dev/ui/fixtures/shell");',
        "src/app/components/shell/account.ts -> src/app/dev/ui/fixtures/shell.ts",
      ],
      [
        "a module importing a fixture through a path alias",
        at("lib", "board", "view.ts"),
        'import { PREVIEW_ACCOUNT } from "@/app/dev/ui/fixtures/shell";',
        "src/lib/board/view.ts -> src/app/dev/ui/fixtures/shell",
      ],
    ])("%s", (_label, file, source, chain) => {
      const modules = base();
      modules.set(file, source);
      expect(fixtureReach(modules)).toEqual([chain]);
    });

    it("names a transitive chain through a shared component", () => {
      const modules = base();
      modules.set(at("app", "page.tsx"), 'import { Banner } from "./components/demo-banner";');
      modules.set(at("app", "components", "demo-banner.tsx"), 'import { PREVIEW_ACCOUNT_LOGIN } from "../dev/ui/fixtures/shell";');
      expect(fixtureReach(modules)).toEqual([
        "src/app/components/demo-banner.tsx -> src/app/dev/ui/fixtures/shell.ts",
        "src/app/page.tsx -> src/app/components/demo-banner.tsx -> src/app/dev/ui/fixtures/shell.ts",
      ]);
    });

    it("does not count a fixture import named only in a comment", () => {
      const modules = base();
      modules.set(at("server", "env.ts"), '// import { PREVIEW_ACCOUNT } from "../app/dev/ui/fixtures/shell";\nexport {};');
      expect(fixtureReach(modules)).toEqual([]);
    });
  });
});
