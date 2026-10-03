import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SRC_ROOT, moduleSpecifiers } from "../../source-scan.testing";
import {
  APPEARANCE_COOKIE_MAX_AGE,
  type AppearanceCookie,
  catsCookie,
  parseAppearance,
  serializeAppearanceCookie,
  themeCookie,
} from "./appearance";

describe("parseAppearance", () => {
  it.each(["system", "light", "dark"] as const)("accepts theme token %s", (theme) => {
    expect(parseAppearance({ theme }).theme).toBe(theme);
  });

  it.each(["on", "off"] as const)("accepts cats token %s", (cats) => {
    expect(parseAppearance({ cats }).cats).toBe(cats);
  });

  it("defaults both fields when cookies are absent", () => {
    expect(parseAppearance({})).toEqual({ theme: "light", cats: "off" });
    expect(parseAppearance()).toEqual({ theme: "light", cats: "off" });
    expect(parseAppearance({ theme: undefined, cats: null })).toEqual({ theme: "light", cats: "off" });
  });

  it.each([
    ["midnight", "midnight"],
    ["empty", ""],
    ["large arbitrary string", "x".repeat(100_000)],
    ["capitalized", "Dark"],
    ["leading whitespace", " dark"],
    ["trailing whitespace", "dark "],
  ])("rejects a %s theme value", (_label, theme) => {
    expect(parseAppearance({ theme })).toEqual({ theme: "light", cats: "off" });
  });

  it.each(["", "On", " on", "off ", "yes", "true", "x".repeat(100_000)])(
    "rejects cats value %j",
    (cats) => {
      expect(parseAppearance({ cats }).cats).toBe("off");
    },
  );

  it("falls back per field: invalid theme beside cats=on yields light + on", () => {
    expect(parseAppearance({ theme: "midnight", cats: "on" })).toEqual({ theme: "light", cats: "on" });
  });

  it("falls back per field: valid theme beside invalid cats keeps the theme", () => {
    expect(parseAppearance({ theme: "dark", cats: "maybe" })).toEqual({ theme: "dark", cats: "off" });
  });

});

// Task 2.3: the module stays framework-free — nothing from react (or react-dom,
// react/*), next or next/*, or src/server, in any import form.
function forbiddenImports(file: string, source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => {
    if (/^(?:react|react-dom|next)(?:\/|$)/.test(specifier)) return true;
    if (/(?:^|\/)src\/server(?:\/|$)/.test(specifier)) return true;
    const target = resolve(dirname(file), specifier);
    return specifier.startsWith(".") && (target === SERVER_ROOT || target.startsWith(SERVER_ROOT + sep));
  });
}

const SERVER_ROOT = join(SRC_ROOT, "server");
const APPEARANCE_MODULE = fileURLToPath(new URL("./appearance.ts", import.meta.url));

describe("appearance module imports", () => {
  it("imports nothing from react, next/*, or src/server", () => {
    expect(forbiddenImports(APPEARANCE_MODULE, readFileSync(APPEARANCE_MODULE, "utf8"))).toEqual([]);
  });

  it.each([
    'import { useState } from "react";',
    'import { jsx } from "react/jsx-runtime";',
    'import { createPortal } from "react-dom";',
    'import { cookies } from "next/headers";',
    'import type { NextRequest } from "next/server";',
    'import "next";',
    'export { getEnv } from "../../server/env";',
    'const db = await import("../../server/db");',
    'import { getDriver } from "@/src/server/db";',
  ])("fails when the module adds %s", (line) => {
    const source = `${readFileSync(APPEARANCE_MODULE, "utf8")}\n${line}\n`;
    expect(forbiddenImports(APPEARANCE_MODULE, source)).toHaveLength(1);
  });

  it("does not count an import named only in a comment", () => {
    expect(forbiddenImports(APPEARANCE_MODULE, '// import { cookies } from "next/headers";\nexport {};')).toEqual([]);
  });
});

describe("appearance cookie serializer", () => {
  it.each(["system", "light", "dark"] as const)("writes theme %s with every attribute", (theme) => {
    const header = serializeAppearanceCookie(themeCookie(theme));
    const [pair, ...attrs] = header.split("; ");
    expect(pair).toBe(`jumphour_theme=${theme}`);
    expect(attrs).toEqual(["Path=/", "Max-Age=31536000", "SameSite=Lax"]);
    expect(header).not.toMatch(/httponly/i);
    expect(header).not.toMatch(/secure/i);
  });

  it.each(["on", "off"] as const)("writes cats %s with every attribute", (cats) => {
    expect(serializeAppearanceCookie(catsCookie(cats))).toBe(
      `jumphour_cats=${cats}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });

  it("uses a one-year max age", () => {
    expect(APPEARANCE_COOKIE_MAX_AGE).toBe(365 * 24 * 60 * 60);
  });

  it("builds cookie-store options with SameSite=Lax, Path=/, one year, and httpOnly false", () => {
    expect(themeCookie("dark")).toEqual({
      name: "jumphour_theme",
      value: "dark",
      path: "/",
      sameSite: "lax",
      maxAge: 31536000,
      httpOnly: false,
    });
    expect(catsCookie("on")).toMatchObject({ name: "jumphour_cats", value: "on", httpOnly: false });
  });

  it.each(["", "Dark", " dark", "dark ", "midnight", "dark; Path=/admin", "on", "x".repeat(10_000)])(
    "refuses to build a theme cookie from %j",
    (value) => {
      expect(() => themeCookie(value as never)).toThrow();
    },
  );

  it.each(["", "On", " on", "off ", "yes", "true", "dark", "on; HttpOnly"])(
    "refuses to build a cats cookie from %j",
    (value) => {
      expect(() => catsCookie(value as never)).toThrow();
    },
  );

  it("refuses to serialize a hand-built or mutated cookie carrying a non-canonical value", () => {
    const forged = { ...themeCookie("dark"), value: "evil; Domain=example.com" } as unknown as AppearanceCookie;
    expect(() => serializeAppearanceCookie(forged)).toThrow();

    const crossed = { ...catsCookie("on"), value: "dark" } as unknown as AppearanceCookie;
    expect(() => serializeAppearanceCookie(crossed)).toThrow();

    const unknownName = { ...catsCookie("on"), name: "jumphour_session" } as unknown as AppearanceCookie;
    expect(() => serializeAppearanceCookie(unknownName)).toThrow();
  });

  it("round-trips: every serialized value parses back to itself", () => {
    for (const theme of ["system", "light", "dark"] as const) {
      const value = serializeAppearanceCookie(themeCookie(theme)).split("; ")[0]!.split("=")[1];
      expect(parseAppearance({ theme: value }).theme).toBe(theme);
    }
    for (const cats of ["on", "off"] as const) {
      const value = serializeAppearanceCookie(catsCookie(cats)).split("; ")[0]!.split("=")[1];
      expect(parseAppearance({ cats: value }).cats).toBe(cats);
    }
  });
});
