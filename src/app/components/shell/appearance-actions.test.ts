// Task 8.4 (design.md Decision 3): the appearance server actions write only
// canonical cookies through the appearance module's builder and serializer,
// with its attributes, and revalidate the layout; anything else writes nothing.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_COOKIE_MAX_AGE, CATS_COOKIE, THEME_COOKIE } from "../../../lib/appearance/appearance";

const set = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({ set }) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const serialize = vi.fn();
vi.mock("../../../lib/appearance/appearance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/appearance/appearance")>();
  return {
    ...actual,
    serializeAppearanceCookie: (cookie: Parameters<typeof actual.serializeAppearanceCookie>[0]) => {
      serialize(cookie);
      return actual.serializeAppearanceCookie(cookie);
    },
  };
});

const { setCatsPreference, setThemePreference } = await import("./appearance-actions");

beforeEach(() => {
  set.mockClear();
  revalidatePath.mockClear();
  serialize.mockClear();
});

const attributes = { path: "/", sameSite: "lax", maxAge: APPEARANCE_COOKIE_MAX_AGE, httpOnly: false };

describe("setThemePreference", () => {
  it.each(["system", "light", "dark"])("writes %s through the serializer and revalidates the layout", async (theme) => {
    await setThemePreference(theme);
    const expected = { name: THEME_COOKIE, value: theme, ...attributes };
    expect(serialize).toHaveBeenCalledWith(expected);
    expect(set).toHaveBeenCalledWith(expected);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each(["Dark", " dark", "dark ", "", "midnight", "on"])("writes nothing for %j", async (theme) => {
    await setThemePreference(theme);
    expect(set).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setCatsPreference", () => {
  it.each(["on", "off"])("writes %s through the serializer and revalidates the layout", async (cats) => {
    await setCatsPreference(cats);
    const expected = { name: CATS_COOKIE, value: cats, ...attributes };
    expect(serialize).toHaveBeenCalledWith(expected);
    expect(set).toHaveBeenCalledWith(expected);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each(["On", "true", "", "dark"])("writes nothing for %j", async (cats) => {
    await setCatsPreference(cats);
    expect(set).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
