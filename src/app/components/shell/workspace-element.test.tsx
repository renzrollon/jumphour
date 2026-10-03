// @vitest-environment jsdom
// Task 8.2 (specs/app-shell/spec.md "Name the workspace from the real GitHub
// App installation"): the workspace element is a static label with one known
// installation, a switcher naming each account with two or more, and the
// neutral "No installation" when the session names no installation or one
// with no stored row. It never renders a numeric id or an invented name.
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createSqliteDriver } from "../../../server/db/sqlite-driver";
import { runMigrations } from "../../../server/db/migrate";
import type { SqlDriver } from "../../../server/db/types";
import { upsertInstallation } from "../../../server/db/installations";
import { resolveWorkspace } from "./workspace";
import { WorkspaceElement } from "./workspace-element";
import { TopAppBar } from "./top-app-bar";

const migrationsDir = path.join(import.meta.dirname, "..", "..", "..", "..", "migrations");
const INVENTED_NAMES = ["Platform delivery", "Priya Nair", "Workspace 1", "Untitled"];

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  upsertInstallation(driver, { githubInstallationId: 41, accountId: 900, accountLogin: "acme" });
  upsertInstallation(driver, { githubInstallationId: 42, accountId: 901, accountLogin: "globex" });
});

afterEach(() => {
  cleanup();
  driver.close();
});

function workspaceSlot(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-shell-slot="workspace"]')!;
}

function expectNoIdOrInventedName(slot: HTMLElement) {
  const text = slot.textContent ?? "";
  expect(text).not.toMatch(/\d/);
  for (const name of INVENTED_NAMES) expect(text).not.toContain(name);
  for (const el of slot.querySelectorAll("[title],[aria-label]")) {
    expect(el.getAttribute("title") ?? "").not.toMatch(/\d/);
    expect(el.getAttribute("aria-label") ?? "").not.toMatch(/\d/);
  }
}

describe("WorkspaceElement in the top app bar", () => {
  it("renders the installation's account login as a static, non-interactive label", () => {
    const { container } = render(<TopAppBar workspace={resolveWorkspace(driver, 41)} />);
    const slot = workspaceSlot(container);
    expect(slot.textContent?.trim()).toBe("acme");
    expect(within(slot).queryByRole("combobox")).toBeNull();
    expect(within(slot).queryByRole("button")).toBeNull();
    expect(slot.querySelector("form, select, input, a")).toBeNull();
    expectNoIdOrInventedName(slot);
  });

  it("renders the neutral label for a session with no installation", () => {
    const { container } = render(<TopAppBar workspace={resolveWorkspace(driver, null)} />);
    const slot = workspaceSlot(container);
    expect(slot.textContent?.trim()).toBe("No installation");
    expect(slot.querySelector("form, select")).toBeNull();
    expectNoIdOrInventedName(slot);
  });

  it("renders the neutral label for a session naming an unstored installation", () => {
    const { container } = render(<TopAppBar workspace={resolveWorkspace(driver, 7777)} />);
    const slot = workspaceSlot(container);
    expect(slot.textContent?.trim()).toBe("No installation");
    expect(slot.textContent).not.toContain("7777");
    expectNoIdOrInventedName(slot);
  });

  it("keeps the full login available when the label is shortened", () => {
    const login = "an-organization-with-a-very-long-account-login-name";
    render(<WorkspaceElement workspace={{ current: { installationId: 1, accountLogin: login }, installations: [] }} />);
    expect(screen.getByText(login).getAttribute("title")).toBe(login);
  });
});

describe("WorkspaceElement switcher", () => {
  it("offers a switcher naming each account once two installations are known, with the shown one selected", () => {
    render(<WorkspaceElement workspace={resolveWorkspace(driver, 42, [41, 42])} />);
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Workspace" });
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toEqual(["acme", "globex"]);
    expect(select.selectedOptions[0]?.textContent).toBe("globex");
    expect(select.name).toBe("installationId");
  });

  it("never renders an installation id as visible text in the switcher", () => {
    const { container } = render(<WorkspaceElement workspace={resolveWorkspace(driver, 41, [41, 42])} />);
    expectNoIdOrInventedName(container);
  });

  it("selects the neutral option when the page shows no stored installation", () => {
    render(<WorkspaceElement workspace={resolveWorkspace(driver, 7777, [41, 42])} />);
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Workspace" });
    expect(select.selectedOptions[0]?.textContent).toBe("No installation");
  });

  it("stays a static label when only one of the known installations is stored", () => {
    const { container } = render(<WorkspaceElement workspace={resolveWorkspace(driver, 41, [41, 9999])} />);
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).toBe("acme");
  });
});
