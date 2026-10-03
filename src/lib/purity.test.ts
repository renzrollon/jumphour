// Task 1.7: everything under src/lib/ stays framework-free, so the same types
// and pure functions serve the server provider, client components, fixtures,
// and tests. No non-test file under src/lib/ may import react (or react-dom,
// react/*), next or next/*, or anything under src/server/, in any import form.
// Generalises the appearance module's own check (appearance.test.ts) to the
// whole directory, so a new lib module is covered without editing this file.
import { describe, expect, it } from "vitest";
import { dirname, join, resolve, sep } from "node:path";
import { SRC_ROOT, isTestFile, listFiles, moduleSpecifiers, readSource, repoPath } from "../source-scan.testing";

const LIB_ROOT = join(SRC_ROOT, "lib");
const SERVER_ROOT = join(SRC_ROOT, "server");

function forbiddenImports(file: string, source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => {
    if (/^(?:react|react-dom|next)(?:\/|$)/.test(specifier)) return true;
    if (/^@\/server(?:\/|$)/.test(specifier)) return true;
    if (/(?:^|\/)src\/server(?:\/|$)/.test(specifier)) return true;
    if (!specifier.startsWith(".")) return false;
    const target = resolve(dirname(file), specifier);
    return target === SERVER_ROOT || target.startsWith(SERVER_ROOT + sep);
  });
}

const LIB_MODULES = listFiles(LIB_ROOT).filter((file) => !isTestFile(file));

describe("src/lib purity", () => {
  it("finds the lib modules it guards", () => {
    const paths = LIB_MODULES.map(repoPath);
    expect(paths).toContain("src/lib/appearance/appearance.ts");
    expect(paths).toContain("src/lib/board/board-view-model.ts");
    expect(paths).toContain("src/lib/time/format-relative-time.ts");
  });

  it("no lib module imports react, next/*, or src/server", () => {
    const offenders = LIB_MODULES.flatMap((file) =>
      forbiddenImports(file, readSource(file)).map((specifier) => `${repoPath(file)} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  describe.each(LIB_MODULES.map((file) => [repoPath(file), file] as const))("%s", (_path, file) => {
    it.each([
      'import { useState } from "react";',
      'import { jsx } from "react/jsx-runtime";',
      'import { createPortal } from "react-dom";',
      'import { cookies } from "next/headers";',
      'import type { NextRequest } from "next/server";',
      'import Link from "next/link";',
      'import "next";',
      `export { getEnv } from "${relativeToServer(file, "env")}";`,
      `const db = await import("${relativeToServer(file, "db")}");`,
      `import type { BoardView } from "${relativeToServer(file, "board/board-view")}";`,
      'import { getDriver } from "@/src/server/db";',
      'import { getDriver } from "@/server/db";',
    ])("fails when the module adds %s", (line) => {
      expect(forbiddenImports(file, `${readSource(file)}\n${line}\n`)).toHaveLength(1);
    });
  });

  it("allows lib-internal and node imports", () => {
    const file = join(LIB_ROOT, "board", "example.ts");
    const source = [
      'import { formatRelativeTime } from "../time/format-relative-time";',
      'import type { BoardViewModel } from "./board-view-model";',
      'import { readFileSync } from "node:fs";',
    ].join("\n");
    expect(forbiddenImports(file, source)).toEqual([]);
  });

  it("does not count an import named only in a comment", () => {
    const file = join(LIB_ROOT, "board", "example.ts");
    expect(forbiddenImports(file, '// import { cookies } from "next/headers";\n/* import "../../server/db"; */\nexport {};')).toEqual([]);
  });
});

/** A relative specifier from `file` to src/server/<target>, the form a real import would use. */
function relativeToServer(file: string, target: string): string {
  const up = dirname(file).slice(SRC_ROOT.length).split(sep).filter(Boolean).map(() => "..");
  return [...up, "server", target].join("/");
}
