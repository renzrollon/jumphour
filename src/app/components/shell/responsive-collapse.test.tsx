// @vitest-environment jsdom
// Task 8.6 (specs/app-shell/spec.md "Keep settings and the account reachable
// on a narrow viewport"; design.md Decision 10). jsdom does not lay out, so
// the collapse is verified the way app-shell.test.tsx verifies the sticky
// bar: by parsing the module CSS and asserting the declarations that produce
// the behavior, plus render assertions for which controls sit in the bar and
// in settings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type CssRule, parseCssRules } from "../../css-rules.testing";

vi.mock("./appearance-actions", () => ({
  setThemePreference: async () => {},
  setCatsPreference: async () => {},
}));

const { TopAppBar } = await import("./top-app-bar");

afterEach(() => {
  cleanup();
});

const read = (file: string) => parseCssRules(readFileSync(join(import.meta.dirname, file), "utf8"));
const barRules = read("top-app-bar.module.css");
const accountRules = read("account-menu.module.css");
const workspaceRules = read("workspace-element.module.css");

const NARROW = "@media (max-width: 759.98px)";
const decl = (rule: CssRule | undefined) => new Map(rule?.declarations ?? []);
const base = (rules: CssRule[], selector: string) =>
  decl(rules.find((r) => r.atRules.length === 0 && r.selector === selector));
const narrow = (rules: CssRule[], selector: string) =>
  decl(rules.find((r) => r.atRules.length === 1 && r.atRules[0] === NARROW && r.selector === selector));

const LONG_LOGIN = "an-extraordinarily-long-github-organization-login-that-cannot-fit";

describe("narrow-viewport media query", () => {
  it("exists in the bar's module CSS at the 760px breakpoint", () => {
    expect(barRules.some((r) => r.atRules[0] === NARROW)).toBe(true);
    // CSS only: no other breakpoint and no width-in-state fallback.
    for (const rule of barRules) {
      for (const at of rule.atRules) expect(at).toBe(NARROW);
    }
  });

  it("moves the search region and the theme and cats slots out of the bar", () => {
    expect(narrow(barRules, ".search").get("display")).toBe("none");
    expect(narrow(barRules, ".wideOnly").get("display")).toBe("none");
  });

  it("never hides the brand, workspace, controls group, settings entry, or account menu", () => {
    for (const rule of barRules.filter((r) => r.atRules.length > 0)) {
      if (rule.selector === ".search" || rule.selector === ".wideOnly") continue;
      expect(decl(rule).get("display")).not.toBe("none");
    }
    for (const rule of accountRules) expect(decl(rule).get("display")).not.toBe("none");
  });

  it("tightens the bar's spacing and narrows the account trigger below the breakpoint", () => {
    expect(narrow(barRules, ".bar").get("gap")).toBe("8px");
    expect(narrow(accountRules, ".trigger").get("max-width")).toBe("112px");
  });
});

describe("the bar at every width", () => {
  it("lays out in one non-wrapping flex row that does not scroll horizontally", () => {
    const bar = base(barRules, ".bar");
    expect(bar.get("display")).toBe("flex");
    expect(bar.get("flex-wrap")).toBe("nowrap");
    expect(bar.get("width")).toBe("100%");
    expect(bar.get("box-sizing")).toBe("border-box");
    expect(bar.get("min-width")).toBe("0");
    for (const rule of barRules) {
      const d = decl(rule);
      for (const prop of ["overflow", "overflow-x"]) {
        expect(["auto", "scroll"]).not.toContain(d.get(prop));
      }
    }
  });

  it("separates its controls with gaps and never positions one over another", () => {
    expect(base(barRules, ".bar").get("gap")).toBe("16px");
    expect(base(barRules, ".controls").get("flex-shrink")).toBe("0");
    for (const rule of [...barRules, ...accountRules, ...workspaceRules]) {
      const position = decl(rule).get("position");
      if (rule.selector === ".bar" && rule.atRules.length === 0) expect(position).toBe("sticky");
      else expect(position).toBeUndefined();
      expect(decl(rule).has("margin-right") && decl(rule).get("margin-right")!.startsWith("-")).toBe(false);
    }
  });

  it("lets only the workspace region shrink, so the fixed controls keep their room", () => {
    const workspace = base(barRules, ".workspace");
    expect(workspace.get("flex")).toBe("0 1 auto");
    expect(workspace.get("min-width")).toBe("0");
    expect(base(barRules, ".brand").get("flex-shrink")).toBe("0");
  });
});

describe("a long account login", () => {
  it("truncates with an ellipsis in both the workspace label and the account trigger", () => {
    for (const d of [base(workspaceRules, ".label"), base(accountRules, ".triggerLabel")]) {
      expect(d.get("overflow")).toBe("hidden");
      expect(d.get("text-overflow")).toBe("ellipsis");
      expect(d.get("white-space")).toBe("nowrap");
      expect(d.get("min-width")).toBe("0");
    }
    expect(base(accountRules, ".trigger").get("max-width")).toBe("180px");
  });

  it("keeps the full value available through title and the open account menu", async () => {
    const { container } = render(
      <TopAppBar
        account={{ login: LONG_LOGIN }}
        workspace={{ current: { installationId: 7, accountLogin: LONG_LOGIN }, installations: [] }}
      />,
    );
    const workspace = container.querySelector('[data-shell-slot="workspace"] [title]')!;
    expect(workspace.getAttribute("title")).toBe(LONG_LOGIN);
    expect(workspace.textContent).toBe(LONG_LOGIN);

    const trigger = screen.getByRole("button", { name: LONG_LOGIN });
    expect(trigger.getAttribute("title")).toBe(LONG_LOGIN);
    await userEvent.setup().click(trigger);
    expect(within(screen.getByRole("dialog", { name: "Account" })).getByText(LONG_LOGIN)).not.toBeNull();
  });
});

describe("what stays reachable below the breakpoint", () => {
  it("keeps the settings entry and account menu outside the collapsible slots", () => {
    const { container } = render(<TopAppBar account={{ login: "octocat" }} />);
    for (const slot of ["theme-control", "cats-toggle"]) {
      expect(container.querySelector(`[data-shell-slot="${slot}"]`)!.className).toContain("wideOnly");
    }
    for (const slot of ["mark", "workspace", "settings-entry", "account-menu"]) {
      const el = container.querySelector(`[data-shell-slot="${slot}"]`)!;
      expect(el.className).not.toContain("wideOnly");
      expect(el.className).not.toContain("search");
    }
  });

  it("offers both preferences in settings, outside the collapsible slots", async () => {
    const { container } = render(<TopAppBar appearance={{ theme: "dark", cats: "on" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Settings" }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog.closest(".wideOnly, [class*='wideOnly']")).toBeNull();
    expect(container.querySelector('[data-shell-slot="settings-entry"]')!.contains(dialog)).toBe(true);
    expect(within(dialog).getByRole("radiogroup", { name: "Theme" })).not.toBeNull();
    expect(within(dialog).getByRole("switch", { name: "Cats theme" })).not.toBeNull();
  });
});
