// The repository guard tests match against stripComments() and
// moduleSpecifiers(); these cases pin the parts a guard's verdict depends on.
import { describe, expect, it } from "vitest";
import { moduleSpecifiers, stripComments } from "./source-scan.testing";

describe("stripComments", () => {
  it("drops line and block comments and keeps line numbering", () => {
    const code = stripComments("a(); // matchMedia\n/* Priya\n Nair */ b();\n");
    expect(code).not.toMatch(/matchMedia|Priya|Nair/);
    expect(code).toContain("a();");
    expect(code).toContain("b();");
    expect(code.split("\n")).toHaveLength(4);
  });

  it("keeps string contents, including a URL's double slash", () => {
    const code = stripComments('const u = "https://example.test/a"; const q = \'Priya Nair\'; // gone');
    expect(code).toContain('"https://example.test/a"');
    expect(code).toContain("'Priya Nair'");
    expect(code).not.toContain("gone");
  });

  it("keeps template text and strips comments inside a template expression", () => {
    const code = stripComments("const t = `a // kept ${b /* gone */ + `c ${d}`} e`; // gone too");
    expect(code).toContain("a // kept");
    expect(code).toContain("`c ${d}`");
    expect(code).toContain("} e`");
    expect(code).not.toContain("gone");
  });

  it("keeps a regex literal whole, even when it holds quotes or slashes", () => {
    const code = stripComments("const r = /[\"'/]+\\//g; const half = a / 2; // gone\nreturn /x/.test(s);");
    expect(code).toContain("/[\"'/]+\\//g");
    expect(code).toContain("a / 2;");
    expect(code).toContain("return /x/.test(s);");
    expect(code).not.toContain("gone");
  });

  it("does not read a JSX closing tag as a regex", () => {
    const code = stripComments('<div>{/* gone */}<p>kept</p></div>; const s = "matchMedia";');
    expect(code).toContain("<p>kept</p></div>");
    expect(code).toContain('"matchMedia"');
    expect(code).not.toContain("gone");
  });
});

describe("moduleSpecifiers", () => {
  it("finds static, type-only, side-effect, re-exported, dynamic, and required modules", () => {
    const source = [
      'import a from "m-default";',
      'import type { B } from "m-type";',
      "import {\n  c,\n  d,\n} from 'm-multiline';",
      'import "m-side-effect";',
      'export { e } from "m-reexport";',
      'export * from "m-star";',
      'const f = await import("m-dynamic");',
      'const g = require("m-require");',
    ].join("\n");
    expect(moduleSpecifiers(source).sort()).toEqual(
      ["m-default", "m-dynamic", "m-multiline", "m-reexport", "m-require", "m-side-effect", "m-star", "m-type"].sort(),
    );
  });

  it("ignores an import that only appears in a comment", () => {
    expect(moduleSpecifiers('// import x from "react";\n/* import "next/headers"; */\nexport const y = 1;')).toEqual([]);
  });
});
