import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("..", import.meta.url));
const fontsPath = fileURLToPath(new URL("./fonts.ts", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name) ? [full] : [];
  });
}

// Matches static imports, re-exports, dynamic imports and require() of a fonts module.
const importsFonts = /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["'](?:[^"']*\/)?fonts(?:\.ts)?["']/;

describe("fonts module", () => {
  it("is imported by no module other than src/app/layout.tsx", () => {
    const importers = sourceFiles(srcRoot)
      .filter((file) => file !== fontsPath && !file.endsWith(`${sep}fonts.test.ts`))
      .filter((file) => importsFonts.test(readFileSync(file, "utf8")))
      .map((file) => relative(srcRoot, file).split(sep).join("/"));
    expect(importers.filter((file) => file !== "app/layout.tsx")).toEqual([]);
  });

  it("declares both faces through next/font/google with the documented fallbacks", () => {
    const source = readFileSync(fontsPath, "utf8");
    expect(source).toMatch(/from\s+["']next\/font\/google["']/);
    expect(source).toContain("Instrument_Sans(");
    expect(source).toContain("JetBrains_Mono(");
    expect(source).toContain('fallback: ["system-ui", "sans-serif"]');
    expect(source).toContain('fallback: ["ui-monospace", "monospace"]');
    expect(source).toMatch(/variable:\s*"--font-instrument-sans"/);
    expect(source).toMatch(/variable:\s*"--font-jetbrains-mono"/);
  });
});
