// Task 10.3 (design.md Decision 9; specs/app-shell/spec.md "Keep the
// interface preview surfaces unreachable unless explicitly enabled"): the
// /dev/ui index responds not-found while previews are disabled — through the
// real `notFound()`, matching ./preview-guard.test.ts's own pattern — and
// renders the primitives-and-shell index, carrying the persistent
// "Preview — fixture data" label, once `JUMPHOUR_UI_PREVIEW=1`. `next/headers`
// and the appearance server actions are stubbed exactly as
// ../../page.test.tsx stubs them; this route reads no database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const request = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (request.cookies.has(name) ? { name, value: request.cookies.get(name)! } : undefined),
  }),
}));

vi.mock("../../components/shell/appearance-actions", () => ({
  setThemePreference: vi.fn(),
  setCatsPreference: vi.fn(),
}));

import DevUiIndexPage from "./page";
import { PREVIEW_ACCOUNT_LOGIN, PREVIEW_WORKSPACE_LOGIN } from "./fixtures/shell";
import { PREVIEW_LABEL } from "./primitives-gallery";

const savedFlag = process.env.JUMPHOUR_UI_PREVIEW;

beforeEach(() => {
  delete process.env.JUMPHOUR_UI_PREVIEW;
  request.cookies.clear();
});

afterEach(() => {
  if (savedFlag === undefined) delete process.env.JUMPHOUR_UI_PREVIEW;
  else process.env.JUMPHOUR_UI_PREVIEW = savedFlag;
});

/** The digest of the not-found error DevUiIndexPage() rejects with, or undefined if it did not. */
async function notFoundDigest(): Promise<string | undefined> {
  try {
    await DevUiIndexPage();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
}

describe("DevUiIndexPage", () => {
  it("responds as not found while JUMPHOUR_UI_PREVIEW is unset", async () => {
    expect(await notFoundDigest()).toMatch(/404/);
  });

  it("responds as not found for a non-canonical flag value", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "true";
    expect(await notFoundDigest()).toMatch(/404/);
  });

  it("renders the primitives-and-shell index carrying the persistent fixture-data label once enabled", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";

    const html = renderToStaticMarkup(await DevUiIndexPage());

    // The shell: AppShell/TopAppBar, labelled from fixture identity data only.
    expect(html).toContain('data-shell-region="app-shell"');
    expect(html).toContain('data-shell-region="top-app-bar"');
    expect(html).toContain(PREVIEW_WORKSPACE_LOGIN);
    expect(html).toContain(PREVIEW_ACCOUNT_LOGIN);

    // The persistent label — always rendered, never conditional or dismissible.
    expect(html).toContain(PREVIEW_LABEL);

    // A representative sample of design.md Decision 11's primitive list, not
    // an exhaustive enumeration: every section carries a stable
    // data-preview-section attribute (./primitives-gallery.tsx's `Section`).
    for (const primitive of [
      "Button",
      "IconButton",
      "Icon set",
      "Select, TextField, TextArea",
      "Badge",
      "SourceBadge",
      "Banner",
      "Skeleton and ProgressIndicator",
      "Menu",
      "Popover",
      "Dialog",
      "Sheet",
      "SegmentedControl",
      "Switch",
    ]) {
      expect(html).toContain(`data-preview-section="${primitive}"`);
    }
  });

  it("renders the same not-found response whether or not a session cookie is present", async () => {
    request.cookies.set("jumphour_session", "sess-1");
    expect(await notFoundDigest()).toMatch(/404/);
  });
});
