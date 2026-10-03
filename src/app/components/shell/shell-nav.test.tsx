// @vitest-environment jsdom
// workflow-board-ui task 6.3 (specs/github-app-installation/spec.md "Present
// a thin signed-in repository and discovery surface", scenario "repository
// view is reachable from the board"; design.md Decision 9): the shell's
// Board / Repositories navigation marks the current item with
// `aria-current="page"` on each route, sits in the top app bar at 760px and
// above, and moves into the account menu below 760px.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseCssRules, readCss, type CssRule } from "../../css-rules.testing";
import { TopAppBar } from "./top-app-bar";
import { AccountMenu } from "./account-menu";
import { SHELL_NAV_ITEMS, ShellNav, type ShellNavId } from "./shell-nav";

afterEach(() => {
  cleanup();
});

const NARROW = "@media (max-width: 759.98px)";

function currentLinks(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('a[aria-current="page"]')).map((a) => a.textContent ?? "");
}

function rule(rules: CssRule[], selector: string, atRules: string[]): CssRule | undefined {
  return rules.find((r) => r.selector === selector && r.atRules.join("|") === atRules.join("|"));
}

describe("ShellNav", () => {
  it("links Board to / and Repositories to /repositories, in that order", () => {
    render(<ShellNav current="board" placement="bar" />);
    const links = within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Board", "/"],
      ["Repositories", "/repositories"],
    ]);
    expect(SHELL_NAV_ITEMS.map((item) => item.id)).toEqual(["board", "repositories"]);
  });

  it.each<[ShellNavId, string]>([
    ["board", "Board"],
    ["repositories", "Repositories"],
  ])("marks only %s as the current page", (current, label) => {
    const { container } = render(<ShellNav current={current} placement="bar" />);
    expect(currentLinks(container)).toEqual([label]);
  });
});

describe("TopAppBar navigation", () => {
  it.each<[ShellNavId, string]>([
    ["board", "Board"],
    ["repositories", "Repositories"],
  ])("renders the navigation in the bar with %s marked current", (current, label) => {
    const { container } = render(<TopAppBar currentNav={current} />);
    const bar = container.querySelector<HTMLElement>('[data-shell-nav="bar"]')!;
    expect(bar).not.toBeNull();
    expect(currentLinks(bar)).toEqual([label]);
  });

  it("renders no navigation when the view names no current item", () => {
    const { container } = render(<TopAppBar />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("keeps the seven shell regions in their fixed order when navigation is present", () => {
    const { container } = render(<TopAppBar currentNav="board" />);
    const order = Array.from(container.querySelectorAll("[data-shell-slot]")).map((el) =>
      el.getAttribute("data-shell-slot"),
    );
    expect(order).toEqual(["mark", "workspace", "search", "theme-control", "cats-toggle", "settings-entry", "account-menu"]);
  });

  it("carries the same navigation, current item marked, inside the account menu", async () => {
    render(<TopAppBar currentNav="repositories" account={{ login: "octocat" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "octocat" }));
    const menu = screen.getByRole("dialog", { name: "Account" });
    const nav = menu.querySelector<HTMLElement>('[data-shell-nav="menu"]')!;
    expect(nav).not.toBeNull();
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Board", "Repositories"]);
    expect(currentLinks(nav)).toEqual(["Repositories"]);
    // Sign out stays the menu's one action.
    expect(within(menu).getByRole("button", { name: "Sign out" })).not.toBeNull();
  });

  it("puts no navigation in the account menu when the view names no current item", async () => {
    render(<AccountMenu account={{ login: "octocat" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "octocat" }));
    expect(screen.getByRole("dialog", { name: "Account" }).querySelector("nav")).toBeNull();
  });
});

describe("navigation placement by viewport (CSS only)", () => {
  it("hides the bar's navigation below 760px and shows it at 760px and above", () => {
    const rules = parseCssRules(readCss(pathToFileURL(path.join(import.meta.dirname, "top-app-bar.module.css"))));
    expect(rule(rules, ".nav", [])?.declarations).toContainEqual(["display", "flex"]);
    expect(rule(rules, ".nav", [NARROW])?.declarations).toContainEqual(["display", "none"]);
  });

  it("shows the account menu's navigation below 760px only", () => {
    const rules = parseCssRules(readCss(pathToFileURL(path.join(import.meta.dirname, "account-menu.module.css"))));
    expect(rule(rules, ".narrowNav", [])?.declarations).toContainEqual(["display", "none"]);
    expect(rule(rules, ".narrowNav", [NARROW])?.declarations).toContainEqual(["display", "block"]);
  });
});
