// Task 10.4 (design.md Decision 9): every page under src/app/dev/ui/ calls
// the preview guard itself, as the first statement of its default export — a
// layout-level guard is not enough, because a page added later under another
// layout would silently escape it. The check enumerates the directory, so a
// page added by any later change is covered the moment it exists. The guard
// must be the real one (imported from ./preview-guard) and called with no
// argument, so the flag always comes from the environment.
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, readSource, stripComments } from "../../../source-scan.testing";

const PREVIEW_ROOT = fileURLToPath(new URL(".", import.meta.url));
const PAGE_FILE = /^page\.[jt]sx?$/;

/** Why `source` (the page at `file`) is not guarded, or undefined when it is. */
function unguardedReason(file: string, source: string, previewRoot: string): string | undefined {
  const code = stripComments(source);

  const guardModule = join(previewRoot, "preview-guard");
  const importsGuard = [...code.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)].some(
    ([, names, specifier]) =>
      /\bpreviewGuard\b(?!\s+as\b)/.test(names!) &&
      specifier!.startsWith(".") &&
      resolve(dirname(file), specifier!).replace(/\.[jt]sx?$/, "") === guardModule,
  );
  if (!importsGuard) return "does not import previewGuard from the preview guard module";

  const header = /\bexport\s+default\s+(?:async\s+)?function\b[^(]*\(/.exec(code);
  if (!header) return "has no `export default function` whose first statement can be checked";

  // Skip the parameter list, then any return type annotation, to the body's opening brace.
  let i = header.index + header[0].length;
  let depth = 1;
  for (; i < code.length && depth > 0; i++) {
    if (code[i] === "(") depth++;
    if (code[i] === ")") depth--;
  }
  let angle = 0;
  while (i < code.length && !(code[i] === "{" && angle === 0)) {
    if (code[i] === "<") angle++;
    if (code[i] === ">") angle--;
    i++;
  }
  const body = code.slice(i + 1);
  if (!/^\s*previewGuard\(\s*\)\s*(?:;|\n)/.test(body)) {
    return "does not call previewGuard() with no argument as the first statement of its default export";
  }
  return undefined;
}

/** Every page under `previewRoot` that is not guarded, as "path: reason". */
function unguardedPages(previewRoot: string): string[] {
  return listFiles(previewRoot)
    .filter((file) => PAGE_FILE.test(file.slice(dirname(file).length + 1)))
    .flatMap((file) => {
      const reason = unguardedReason(file, readSource(file), previewRoot);
      return reason ? [`${file.slice(previewRoot.length)}: ${reason}`] : [];
    });
}

const GUARDED_PAGE = `import { previewGuard } from "./preview-guard";
export default async function Page() {
  previewGuard();
  return null;
}
`;

let scratch: string | undefined;

afterEach(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

/** A throwaway preview root holding the given pages, keyed by path relative to it. */
function previewTree(pages: Record<string, string>): string {
  scratch = mkdtempSync(join(tmpdir(), "jumphour-preview-"));
  writeFileSync(join(scratch, "preview-guard.ts"), "export function previewGuard(): void {}\n");
  for (const [path, source] of Object.entries(pages)) {
    mkdirSync(dirname(join(scratch, path)), { recursive: true });
    writeFileSync(join(scratch, path), source);
  }
  return scratch + "/";
}

describe("preview guard coverage", () => {
  it("finds the /dev/ui index among the preview pages", () => {
    const pages = listFiles(PREVIEW_ROOT).filter((file) => PAGE_FILE.test(file.slice(dirname(file).length + 1)));
    expect(pages).toContain(join(PREVIEW_ROOT, "page.tsx"));
    expect(pages).toContain(join(PREVIEW_ROOT, "board", "page.tsx"));
  });

  it("finds every page under src/app/dev/ui calling the guard first", () => {
    const unguarded = unguardedPages(PREVIEW_ROOT);
    expect(unguarded, `unguarded preview pages under src/app/dev/ui/: ${unguarded.join("; ")}`).toEqual([]);
  });

  it("accepts a guarded page at any depth", () => {
    const root = previewTree({
      "page.tsx": GUARDED_PAGE,
      "board/page.tsx": GUARDED_PAGE.replace("./preview-guard", "../preview-guard"),
      "flows/launch/page.tsx": `// previewGuard runs first.
import { previewGuard } from "../../preview-guard";
import { cookies } from "next/headers";

export default async function LaunchPreview({ params }: { params: Promise<{ step: string }> }): Promise<JSX.Element | null> {
  previewGuard()
  const store = await cookies();
  return null;
}
`,
    });
    expect(unguardedPages(root)).toEqual([]);
  });

  it("fails against a deliberately unguarded page, naming it", () => {
    const root = previewTree({
      "page.tsx": GUARDED_PAGE,
      "board/page.tsx": `export default function BoardPreview() {\n  return null;\n}\n`,
    });
    expect(unguardedPages(root)).toEqual([
      "board/page.tsx: does not import previewGuard from the preview guard module",
    ]);
  });

  it.each([
    [
      "calls the guard after other work",
      `import { cookies } from "next/headers";\nimport { previewGuard } from "../preview-guard";\nexport default async function P() {\n  const store = await cookies();\n  previewGuard();\n  return null;\n}\n`,
      "does not call previewGuard() with no argument as the first statement of its default export",
    ],
    [
      "passes an enabling argument",
      `import { previewGuard } from "../preview-guard";\nexport default function P() {\n  previewGuard({ uiPreviewEnabled: true });\n  return null;\n}\n`,
      "does not call previewGuard() with no argument as the first statement of its default export",
    ],
    [
      "only names the guard in a comment",
      `import { previewGuard } from "../preview-guard";\nexport default function P() {\n  // previewGuard();\n  return null;\n}\n`,
      "does not call previewGuard() with no argument as the first statement of its default export",
    ],
    [
      "calls a look-alike from another module",
      `import { previewGuard } from "../../somewhere-else/preview-guard";\nexport default function P() {\n  previewGuard();\n  return null;\n}\n`,
      "does not import previewGuard from the preview guard module",
    ],
    [
      "has no default-exported function",
      `import { previewGuard } from "../preview-guard";\nconst P = () => {\n  previewGuard();\n  return null;\n};\nexport default P;\n`,
      "has no `export default function` whose first statement can be checked",
    ],
  ])("fails when a page %s", (_label, source, reason) => {
    const root = previewTree({ "page.tsx": GUARDED_PAGE, "panels/page.tsx": source });
    expect(unguardedPages(root)).toEqual([`panels/page.tsx: ${reason}`]);
  });
});
