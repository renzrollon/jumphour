// @vitest-environment jsdom
// design-system-and-app-shell task 11.1 (specs/appearance-preferences/spec.md
// "Keep the cats layer off by default and purely decorative", edge case "the
// same screen with cats on and cats off"): the signed-in shell and the
// signed-out view, captured once with cats off and once with cats on, have
// the same controls in the same order with the same accessible names, the same
// instructional and error copy, and the same spacing classes. The permitted
// differences are decorative accents (anything hidden from assistive
// technology, and the root `data-jh-cats` hook they style from), the visible
// labels of the Light and Dark theme options, and the cats switch's own
// checked state. Everything else must match element for element.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
}));

// next/font/google only runs under the Next compiler; stand in for its classes.
vi.mock("../../fonts", () => ({ fontVariableClasses: "font-sans-var font-mono-var" }));

vi.mock("./appearance-actions", () => ({
  setThemePreference: vi.fn(async () => {}),
  setCatsPreference: vi.fn(async () => {}),
}));

import RootLayout from "../../layout";
import { AppShell } from "./app-shell";
import type { WorkspaceView } from "./workspace";
import { SignedOutView } from "../signed-out-view";
import type { Appearance, Cats, Theme } from "../../../lib/appearance/appearance";

afterEach(() => {
  cleanup();
  cookieJar.clear();
});

const THEMES: readonly Theme[] = ["system", "light", "dark"];

const ONE_INSTALLATION: WorkspaceView = {
  current: { installationId: 11, accountLogin: "octo-org" },
  installations: [{ installationId: 11, accountLogin: "octo-org" }],
};

const TWO_INSTALLATIONS: WorkspaceView = {
  current: { installationId: 11, accountLogin: "octo-org" },
  installations: [
    { installationId: 11, accountLogin: "octo-org" },
    { installationId: 12, accountLogin: "octo-labs" },
  ],
};

const ACCOUNT = { login: "octocat" };

const CONTROLS = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  '[role="radio"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="tab"]',
].join(", ");

const THEME_OPTION_NAMES = new Set(["System theme", "Light theme", "Dark theme"]);
const CATS_SWITCH_NAME = "Cats theme";
const ID_REFERENCES = ["id", "for", "aria-labelledby", "aria-describedby", "aria-controls"];

interface ScreenSnapshot {
  /** `role "accessible name"` for every control, in document order. */
  controls: string[];
  /** Every piece of announced text outside a control, in document order. */
  copy: string[];
  /** The class attribute of every announced element, in document order. */
  classes: string[];
  /** The announced tree, with ids canonicalized and the permitted differences masked. */
  markup: string;
  /** `accessible name: visible label` for every theme option. */
  themeOptionLabels: string[];
  /** aria-checked of every cats switch. */
  catsChecked: string[];
  /** The root's data-jh-cats hook, when the capture includes <html>. */
  catsHook: string | null;
}

const normalize = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

function roleOf(element: Element): string {
  const role = element.getAttribute("role");
  if (role) return role;
  const tag = element.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "input") return `input[type=${element.getAttribute("type") ?? "text"}]`;
  return tag;
}

function accessibleName(root: Element, element: Element): string {
  const byId = (id: string) => root.querySelector(`#${CSS.escape(id)}`);
  const label = element.getAttribute("aria-label");
  if (label !== null) return normalize(label);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) return normalize(labelledBy.split(/\s+/).map((id) => byId(id)?.textContent ?? "").join(" "));
  if (element.id) {
    const forLabel = root.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (forLabel) return normalize(forLabel.textContent);
  }
  return normalize(element.textContent);
}

/** Captures `source` with decoration removed; `source` is not modified. */
function snapshot(source: Element): ScreenSnapshot {
  const root = source.cloneNode(true) as Element;
  for (const hidden of root.querySelectorAll('[aria-hidden="true"]')) hidden.remove();

  const controls = [...root.querySelectorAll(CONTROLS)];
  const themeOptions = controls.filter(
    (control) => control.getAttribute("role") === "radio" && THEME_OPTION_NAMES.has(accessibleName(root, control)),
  );
  const catsSwitches = controls.filter(
    (control) => control.getAttribute("role") === "switch" && accessibleName(root, control) === CATS_SWITCH_NAME,
  );

  const copy: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = normalize(node.textContent);
    if (text && !node.parentElement?.closest(CONTROLS)) copy.push(text);
  }

  const snap: Omit<ScreenSnapshot, "markup"> = {
    controls: controls.map((control) => `${roleOf(control)} "${accessibleName(root, control)}"`),
    copy,
    classes: [root, ...root.querySelectorAll("*")].map((element) => element.getAttribute("class") ?? ""),
    themeOptionLabels: themeOptions.map((option) => `${accessibleName(root, option)}: ${normalize(option.textContent)}`),
    catsChecked: catsSwitches.map((control) => control.getAttribute("aria-checked") ?? ""),
    catsHook: root.getAttribute("data-jh-cats"),
  };

  // Mask the permitted differences, then canonicalize React's generated ids,
  // which differ between two separate client renders.
  for (const option of themeOptions) option.textContent = "{theme option label}";
  for (const control of catsSwitches) control.setAttribute("aria-checked", "{cats state}");
  root.removeAttribute("data-jh-cats");
  const ids = new Map<string, string>();
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const name of ID_REFERENCES) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      const canonical = value.split(/\s+/).map((id) => {
        if (!ids.has(id)) ids.set(id, `id-${ids.size + 1}`);
        return ids.get(id)!;
      });
      element.setAttribute(name, canonical.join(" "));
    }
  }

  return { ...snap, markup: root.outerHTML };
}

function expectCatsInvariant(off: ScreenSnapshot, on: ScreenSnapshot) {
  expect(on.controls).toEqual(off.controls);
  expect(on.copy).toEqual(off.copy);
  expect(on.classes).toEqual(off.classes);
  expect(on.markup).toBe(off.markup);
}

async function renderedPage(cats: Cats, theme: Theme, children: ReactElement): Promise<Element> {
  cookieJar.set("jumphour_theme", theme);
  cookieJar.set("jumphour_cats", cats);
  const markup = renderToStaticMarkup(await RootLayout({ children }));
  return new DOMParser().parseFromString(markup, "text/html").documentElement;
}

describe("cats invariance", () => {
  describe("the signed-out view", () => {
    it.each([
      ["sign-in available", { signInHref: "https://github.com/login/oauth/authorize?client_id=x", signInFailed: false }],
      ["OAuth not configured", { signInHref: null, signInFailed: false }],
      ["sign-in failed", { signInHref: "https://github.com/login/oauth/authorize?client_id=x", signInFailed: true }],
    ])("is identical with cats off and on when %s", async (_label, props) => {
      for (const theme of THEMES) {
        const off = snapshot(await renderedPage("off", theme, <SignedOutView {...props} />));
        const on = snapshot(await renderedPage("on", theme, <SignedOutView {...props} />));
        expect(off.catsHook).toBeNull();
        expect(on.catsHook).toBe("on");
        expect(off.copy.length).toBeGreaterThan(0);
        expectCatsInvariant(off, on);
      }
    });
  });

  describe("the signed-in shell", () => {
    const shell = (appearance: Appearance, workspace: WorkspaceView) => (
      <AppShell workspace={workspace} account={ACCOUNT} appearance={appearance}>
        <p>Repository surface</p>
      </AppShell>
    );

    it.each(THEMES)("is identical inside the root layout with cats off and on (theme %s)", async (theme) => {
      const off = snapshot(await renderedPage("off", theme, shell({ theme, cats: "off" }, ONE_INSTALLATION)));
      const on = snapshot(await renderedPage("on", theme, shell({ theme, cats: "on" }, ONE_INSTALLATION)));
      expect([off.catsHook, on.catsHook]).toEqual([null, "on"]);
      expectCatsInvariant(off, on);
    });

    async function capture(appearance: Appearance, workspace: WorkspaceView, open: string | null): Promise<ScreenSnapshot> {
      const { container } = render(shell(appearance, workspace));
      if (open) {
        await userEvent.setup().click(screen.getByRole("button", { name: open }));
        expect(screen.getByRole("dialog")).toBeDefined();
      }
      const snap = snapshot(container);
      cleanup();
      return snap;
    }

    const cases = THEMES.flatMap((theme) =>
      [
        ["one installation", ONE_INSTALLATION],
        ["two installations", TWO_INSTALLATIONS],
      ].flatMap(([workspaceLabel, workspace]) =>
        [null, "Settings", ACCOUNT.login].map((open) => ({
          theme,
          workspaceLabel: workspaceLabel as string,
          workspace: workspace as WorkspaceView,
          open,
        })),
      ),
    );

    it.each(cases)(
      "has the same controls, names, copy, and spacing with cats off and on (theme $theme, $workspaceLabel, open: $open)",
      async ({ theme, workspace, open }) => {
        const off = await capture({ theme, cats: "off" }, workspace, open);
        const on = await capture({ theme, cats: "on" }, workspace, open);
        expectCatsInvariant(off, on);
      },
    );

    it("differs only in the Light and Dark option labels and the cats switch's own state", async () => {
      const off = await capture({ theme: "dark", cats: "off" }, ONE_INSTALLATION, "Settings");
      const on = await capture({ theme: "dark", cats: "on" }, ONE_INSTALLATION, "Settings");

      // Two theme controls and two cats switches: the bar's and the settings surface's.
      const plain = ["System theme: System", "Light theme: Light", "Dark theme: Dark"];
      const playful = ["System theme: System", "Light theme: Sunny spot", "Dark theme: Night prowl"];
      expect(off.themeOptionLabels).toEqual([...plain, ...plain]);
      expect(on.themeOptionLabels).toEqual([...playful, ...playful]);
      expect(off.catsChecked).toEqual(["false", "false"]);
      expect(on.catsChecked).toEqual(["true", "true"]);

      // The accessible names of the theme options do not follow the playful labels.
      const themeOptions = on.controls.filter((control) => control.startsWith("radio "));
      expect(themeOptions).toEqual([
        'radio "System theme"',
        'radio "Light theme"',
        'radio "Dark theme"',
        'radio "System theme"',
        'radio "Light theme"',
        'radio "Dark theme"',
      ]);
      expect(on.controls.join("\n")).not.toMatch(/Sunny spot|Night prowl/);
    });
  });
});
