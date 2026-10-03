// @vitest-environment jsdom
// Task 8.5 (specs/app-shell/spec.md "Present appearance settings in a
// settings surface"): the settings popover holds the Appearance and Cats
// sections only, binds the cats description to the toggle, shows the same
// selections as the top-bar controls, and holds no credential, connection,
// billing, or team-administration control.
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

const { SettingsPopover, CATS_DESCRIPTION } = await import("./settings-popover");
const { TopAppBar } = await import("./top-app-bar");

beforeEach(() => {
  setThemePreference.mockClear();
  setCatsPreference.mockClear();
});

afterEach(() => {
  cleanup();
});

async function openSettings(): Promise<HTMLElement> {
  await userEvent.setup().click(screen.getByRole("button", { name: "Settings" }));
  return screen.getByRole("dialog", { name: "Settings" });
}

function checkedTheme(scope: HTMLElement): string | null {
  const group = within(scope).getByRole("radiogroup", { name: "Theme" });
  const checked = within(group).getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true");
  expect(checked).toHaveLength(1);
  return checked[0]!.getAttribute("aria-label");
}

function catsChecked(scope: HTMLElement): string | null {
  return within(scope).getByRole("switch", { name: "Cats theme" }).getAttribute("aria-checked");
}

describe("SettingsPopover", () => {
  it("opens from a trigger named Settings with Appearance and Cats sections", async () => {
    render(<SettingsPopover appearance={{ theme: "light", cats: "off" }} />);
    const trigger = screen.getByRole("button", { name: "Settings" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    const dialog = await openSettings();
    const sections = Array.from(dialog.querySelectorAll("[data-settings-section]")).map((el) =>
      el.getAttribute("data-settings-section"),
    );
    expect(sections).toEqual(["appearance", "cats"]);
    expect(within(dialog).getByRole("region", { name: "Appearance" })).not.toBeNull();
    expect(within(dialog).getByRole("region", { name: "Cats" })).not.toBeNull();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(3);
  });

  it("binds the cats description to the toggle through aria-describedby", async () => {
    render(<SettingsPopover appearance={{ theme: "light", cats: "off" }} />);
    const dialog = await openSettings();
    const toggle = within(dialog).getByRole("switch", { name: "Cats theme" });
    const describedBy = toggle.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)!.textContent).toBe(CATS_DESCRIPTION);
    expect(CATS_DESCRIPTION).toBe("Adds subtle cat accents without changing the board.");
  });

  it("sends a change made in settings to the same server actions as the bar", async () => {
    render(<SettingsPopover appearance={{ theme: "dark", cats: "off" }} />);
    const dialog = await openSettings();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("radio", { name: "System theme" }));
    expect(setThemePreference).toHaveBeenCalledWith("system");
    await user.click(within(dialog).getByRole("switch", { name: "Cats theme" }));
    expect(setCatsPreference).toHaveBeenCalledWith("on");
  });

  it("contains no token, password, connection, billing, or team-administration control", async () => {
    render(<SettingsPopover appearance={{ theme: "system", cats: "on" }} />);
    const dialog = await openSettings();
    expect(dialog.querySelectorAll("input, textarea, select, form, a")).toHaveLength(0);
    expect(within(dialog).queryAllByRole("textbox")).toHaveLength(0);
    // The only controls are the three theme radios and the cats switch.
    const controls = Array.from(dialog.querySelectorAll("button"));
    expect(controls.map((c) => c.getAttribute("role"))).toEqual(["radio", "radio", "radio", "switch"]);
    expect(dialog.textContent).not.toMatch(/token|password|secret|credential|connect|sign in|authori[sz]|billing|plan|team|admin|member/i);
  });
});

describe("SettingsPopover inside TopAppBar", () => {
  const cases: Array<[Appearance, string, string]> = [
    [{ theme: "system", cats: "on" }, "System theme", "true"],
    [{ theme: "dark", cats: "off" }, "Dark theme", "false"],
    [{ theme: "light", cats: "off" }, "Light theme", "false"],
  ];

  it.each(cases)("shows the same selections as the bar's controls for %o", async (appearance, theme, cats) => {
    const { container } = render(<TopAppBar appearance={appearance} />);
    const dialog = await openSettings();
    const barTheme = container.querySelector<HTMLElement>('[data-shell-slot="theme-control"]')!;
    const barCats = container.querySelector<HTMLElement>('[data-shell-slot="cats-toggle"]')!;
    expect(checkedTheme(barTheme)).toBe(theme);
    expect(checkedTheme(dialog)).toBe(theme);
    expect(catsChecked(barCats)).toBe(cats);
    expect(catsChecked(dialog)).toBe(cats);
  });

  it("renders the settings popover in the settings-entry slot", () => {
    const { container } = render(<TopAppBar />);
    const slot = container.querySelector('[data-shell-slot="settings-entry"]')!;
    expect(within(slot as HTMLElement).getByRole("button", { name: "Settings" })).not.toBeNull();
  });
});
