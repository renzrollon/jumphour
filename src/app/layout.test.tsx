// Task 4.1: the root layout stamps the appearance attribute matrix on <html>
// from the two cookies, read through parseAppearance().
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
  }),
}));

// next/font/google only runs under the Next compiler; stand in for its classes.
vi.mock("./fonts", () => ({
  fontVariableClasses: "font-sans-var font-mono-var",
}));

const { default: RootLayout } = await import("./layout");

async function renderHtmlTag(cookies: Record<string, string>): Promise<string> {
  cookieJar.clear();
  for (const [name, value] of Object.entries(cookies)) cookieJar.set(name, value);
  const markup = renderToStaticMarkup(await RootLayout({ children: <p>child</p> }));
  const match = /<html[^>]*>/.exec(markup);
  if (!match) throw new Error(`no <html> tag in: ${markup}`);
  return match[0];
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

beforeEach(() => cookieJar.clear());

describe("RootLayout appearance attributes", () => {
  const matrix = [
    { theme: "system", cats: "off", jhTheme: null, jhCats: null },
    { theme: "system", cats: "on", jhTheme: null, jhCats: "on" },
    { theme: "light", cats: "off", jhTheme: "light", jhCats: null },
    { theme: "light", cats: "on", jhTheme: "light", jhCats: "on" },
    { theme: "dark", cats: "off", jhTheme: "dark", jhCats: null },
    { theme: "dark", cats: "on", jhTheme: "dark", jhCats: "on" },
  ] as const;

  it.each(matrix)("theme=$theme cats=$cats", async ({ theme, cats, jhTheme, jhCats }) => {
    const tag = await renderHtmlTag({ jumphour_theme: theme, jumphour_cats: cats });
    expect(attr(tag, "data-jh-theme")).toBe(jhTheme);
    expect(attr(tag, "data-jh-cats")).toBe(jhCats);
  });

  it("stamps no data-jh-theme attribute at all for system", async () => {
    const tag = await renderHtmlTag({ jumphour_theme: "system", jumphour_cats: "on" });
    expect(tag).not.toContain("data-jh-theme");
  });

  it("never stamps data-jh-cats with any value other than on", async () => {
    const tag = await renderHtmlTag({ jumphour_theme: "dark", jumphour_cats: "off" });
    expect(tag).not.toContain("data-jh-cats");
  });

  it("falls back to light and cats off when the cookies are absent or non-canonical", async () => {
    const cases: Record<string, string>[] = [{}, { jumphour_theme: "Dark", jumphour_cats: " on" }];
    for (const cookies of cases) {
      const tag = await renderHtmlTag(cookies);
      expect(attr(tag, "data-jh-theme")).toBe("light");
      expect(tag).not.toContain("data-jh-cats");
    }
  });

  it("applies the font variable classes and renders children in body", async () => {
    cookieJar.clear();
    const markup = renderToStaticMarkup(await RootLayout({ children: <p>child</p> }));
    const tag = /<html[^>]*>/.exec(markup)?.[0] ?? "";
    expect(attr(tag, "class")).toBe("font-sans-var font-mono-var");
    expect(attr(tag, "lang")).toBe("en");
    expect(markup).toContain("<body><p>child</p></body>");
  });
});

describe("RootLayout stylesheet imports", () => {
  it("imports tokens.css before globals.css", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    const tokens = source.indexOf('import "./tokens.css"');
    const globals = source.indexOf('import "./globals.css"');
    expect(tokens).toBeGreaterThanOrEqual(0);
    expect(globals).toBeGreaterThan(tokens);
  });
});
