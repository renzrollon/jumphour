// @vitest-environment jsdom
// Task 8.3 (specs/app-shell/spec.md "Identify the signed-in account and offer
// sign out"): the account menu names the signed-in GitHub login read through
// getUser(), falls back to a neutral label when the row is missing, never
// shows a numeric id, and offers only the sign-out form.
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSqliteDriver } from "../../../server/db/sqlite-driver";
import { runMigrations } from "../../../server/db/migrate";
import type { SqlDriver } from "../../../server/db/types";
import { upsertUser } from "../../../server/db/users";
import { resolveAccount } from "./account";
import { AccountMenu, NEUTRAL_ACCOUNT_LABEL } from "./account-menu";
import { TopAppBar } from "./top-app-bar";

const migrationsDir = path.join(import.meta.dirname, "..", "..", "..", "..", "migrations");
const OCTOCAT_ID = 583231;

let driver: SqlDriver;

beforeEach(() => {
  driver = createSqliteDriver(":memory:");
  runMigrations(driver, migrationsDir);
  upsertUser(driver, { githubUserId: OCTOCAT_ID, login: "octocat" });
});

afterEach(() => {
  cleanup();
  driver.close();
});

async function openMenu(): Promise<HTMLElement> {
  const trigger = screen.getByRole("button", { expanded: false });
  await userEvent.setup().click(trigger);
  return screen.getByRole("dialog", { name: "Account" });
}

describe("resolveAccount", () => {
  it("returns the stored login", () => {
    expect(resolveAccount(driver, OCTOCAT_ID)).toEqual({ login: "octocat" });
  });

  it("returns null when the user row is missing", () => {
    expect(resolveAccount(driver, 12345)).toEqual({ login: null });
  });
});

describe("AccountMenu", () => {
  it("shows the GitHub login on the trigger and in the open menu", async () => {
    render(<AccountMenu account={resolveAccount(driver, OCTOCAT_ID)} />);
    expect(screen.getByRole("button", { name: "octocat" })).not.toBeNull();
    const menu = await openMenu();
    expect(within(menu).getByText("octocat")).not.toBeNull();
  });

  it("shows a neutral label and still offers sign out when the user row is missing", async () => {
    const { container } = render(<AccountMenu account={resolveAccount(driver, 12345)} />);
    expect(screen.getByRole("button", { name: "Account" })).not.toBeNull();
    const menu = await openMenu();
    expect(within(menu).getByText(NEUTRAL_ACCOUNT_LABEL)).not.toBeNull();
    expect(within(menu).getByRole("button", { name: "Sign out" })).not.toBeNull();
    expect(container.textContent).not.toContain("12345");
  });

  it("never renders a numeric identifier, in text or attributes", async () => {
    for (const githubUserId of [OCTOCAT_ID, 12345]) {
      const { container, unmount } = render(<AccountMenu account={resolveAccount(driver, githubUserId)} />);
      await openMenu();
      expect(container.textContent).not.toMatch(/\d/);
      for (const el of container.querySelectorAll("*")) {
        for (const attr of ["title", "aria-label", "value"]) {
          expect(el.getAttribute(attr) ?? "").not.toContain(String(githubUserId));
        }
      }
      unmount();
    }
  });

  it("offers only the sign-out form, posting to the local sign-out route", async () => {
    render(<AccountMenu account={resolveAccount(driver, OCTOCAT_ID)} />);
    const menu = await openMenu();

    const forms = menu.querySelectorAll("form");
    expect(forms).toHaveLength(1);
    expect(forms[0]!.getAttribute("method")).toBe("post");
    expect(forms[0]!.getAttribute("action")).toBe("/api/session/signout");

    const controls = menu.querySelectorAll("button, a, input, select, textarea");
    expect(controls).toHaveLength(1);
    expect(controls[0]!.textContent).toBe("Sign out");
    expect(controls[0]!.getAttribute("type")).toBe("submit");
  });

  it("contains no administration, billing, or credential item", async () => {
    render(<AccountMenu account={resolveAccount(driver, OCTOCAT_ID)} />);
    const menu = await openMenu();
    expect(menu.textContent).not.toMatch(
      /admin|team|member|billing|plan|payment|token|password|secret|credential|api key|connect|authoriz/i,
    );
    expect(menu.querySelector("input, textarea, select")).toBeNull();
  });

  it("is the account slot of the top app bar", () => {
    const { container } = render(<TopAppBar account={resolveAccount(driver, OCTOCAT_ID)} />);
    const slot = container.querySelector<HTMLElement>('[data-shell-slot="account-menu"]')!;
    expect(within(slot).getByRole("button", { name: "octocat" }).getAttribute("aria-haspopup")).toBe("dialog");
  });
});
