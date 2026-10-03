// @vitest-environment jsdom
// Task 8.4 (specs/appearance-preferences/spec.md): the theme control and the
// cats toggle reflect the server-read preference, send a change to the server
// action without computing or applying a theme on the client, and — with cats
// on — change only the visible Light/Dark labels, never the accessible names.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Appearance } from "../../../lib/appearance/appearance";

const setThemePreference = vi.fn(async (_theme: string) => {});
const setCatsPreference = vi.fn(async (_cats: string) => {});
vi.mock("./appearance-actions", () => ({
  setThemePreference: (theme: string) => setThemePreference(theme),
  setCatsPreference: (cats: string) => setCatsPreference(cats),
}));

const { ThemeControl } = await import("./theme-control");
const { CatsToggle } = await import("./cats-toggle");
const { TopAppBar } = await import("./top-app-bar");

const matchMedia = vi.fn();

beforeEach(() => {
  setThemePreference.mockClear();
  setCatsPreference.mockClear();
  matchMedia.mockClear();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-jh-theme");
  document.documentElement.removeAttribute("data-jh-cats");
});

const NAMES = ["System theme", "Light theme", "Dark theme"];

function radios() {
  return within(screen.getByRole("radiogroup", { name: "Theme" })).getAllByRole("radio");
}

function checkedName(): string | null {
  const checked = radios().filter((radio) => radio.getAttribute("aria-checked") === "true");
  expect(checked).toHaveLength(1);
  return checked[0]!.getAttribute("aria-label");
}

describe("ThemeControl", () => {
  it.each([
    ["system", "System theme"],
    ["light", "Light theme"],
    ["dark", "Dark theme"],
  ] as const)("marks the server-read %s choice as current", (theme, name) => {
    render(<ThemeControl appearance={{ theme, cats: "off" }} />);
    expect(checkedName()).toBe(name);
  });

  it("sends a change to the server action and applies nothing on the client", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ThemeControl appearance={{ theme: "light", cats: "off" }} />);

    await user.click(screen.getByRole("radio", { name: "Dark theme" }));

    expect(setThemePreference).toHaveBeenCalledWith("dark");
    expect(matchMedia).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute("data-jh-theme")).toBe(false);
    // The control keeps showing the server-read value until the revalidated
    // render delivers the new one — no local copy of the choice.
    expect(checkedName()).toBe("Light theme");

    rerender(<ThemeControl appearance={{ theme: "dark", cats: "off" }} />);
    expect(checkedName()).toBe("Dark theme");
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it("does not call the action when the current choice is selected again", async () => {
    render(<ThemeControl appearance={{ theme: "dark", cats: "off" }} />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(setThemePreference).not.toHaveBeenCalled();
  });

  it("shows plain labels with cats off", () => {
    render(<ThemeControl appearance={{ theme: "light", cats: "off" }} />);
    expect(radios().map((radio) => radio.textContent)).toEqual(["System", "Light", "Dark"]);
    expect(radios().map((radio) => radio.getAttribute("aria-label"))).toEqual(NAMES);
  });

  it("changes the visible labels with cats on while the accessible names stay the same", () => {
    render(<ThemeControl appearance={{ theme: "light", cats: "on" }} />);
    expect(radios().map((radio) => radio.textContent)).toEqual(["System", "Sunny spot", "Night prowl"]);
    expect(radios().map((radio) => radio.getAttribute("aria-label"))).toEqual(NAMES);
    for (const name of NAMES) expect(screen.getByRole("radio", { name })).not.toBeNull();
  });
});

describe("CatsToggle", () => {
  it.each([
    ["off", "false"],
    ["on", "true"],
  ] as const)("reflects the server-read cats %s", (cats, checked) => {
    render(<CatsToggle appearance={{ theme: "light", cats }} />);
    expect(screen.getByRole("switch", { name: "Cats theme" }).getAttribute("aria-checked")).toBe(checked);
  });

  it("sends the opposite value to the server action without applying it on the client", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CatsToggle appearance={{ theme: "light", cats: "off" }} />);
    await user.click(screen.getByRole("switch", { name: "Cats theme" }));
    expect(setCatsPreference).toHaveBeenCalledWith("on");
    expect(document.documentElement.hasAttribute("data-jh-cats")).toBe(false);

    rerender(<CatsToggle appearance={{ theme: "light", cats: "on" }} />);
    expect(screen.getByRole("switch", { name: "Cats theme" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("switch", { name: "Cats theme" }));
    expect(setCatsPreference).toHaveBeenLastCalledWith("off");
  });

  it("binds a description when given one", () => {
    render(<CatsToggle appearance={{ theme: "light", cats: "off" }} describedBy="cats-desc" />);
    expect(screen.getByRole("switch", { name: "Cats theme" }).getAttribute("aria-describedby")).toBe("cats-desc");
  });
});

describe("appearance controls in the top app bar", () => {
  it("defaults to Light with cats off when no preference is passed", () => {
    render(<TopAppBar />);
    expect(checkedName()).toBe("Light theme");
    expect(screen.getByRole("switch", { name: "Cats theme" }).getAttribute("aria-checked")).toBe("false");
  });

  it("places both controls in their slots, reflecting the passed preference", () => {
    const appearance: Appearance = { theme: "system", cats: "on" };
    const { container } = render(<TopAppBar appearance={appearance} />);
    const theme = container.querySelector<HTMLElement>('[data-shell-slot="theme-control"]')!;
    const cats = container.querySelector<HTMLElement>('[data-shell-slot="cats-toggle"]')!;
    expect(within(theme).getByRole("radio", { name: "System theme" }).getAttribute("aria-checked")).toBe("true");
    expect(within(cats).getByRole("switch", { name: "Cats theme" }).getAttribute("aria-checked")).toBe("true");
  });
});
