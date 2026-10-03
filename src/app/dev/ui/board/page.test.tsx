// workflow-board-ui task 7.3 (specs/ui-preview-gallery/spec.md "Serve preview
// pages only when explicitly enabled", "Reproduce the designed board scenarios
// by name"): /dev/ui/board answers not-found — through the real `notFound()` —
// unless JUMPHOUR_UI_PREVIEW is exactly "1", and then renders the fixture
// board under the "Preview — fixture data" label naming the displayed
// scenario. `next/headers`, `next/navigation`, and the appearance server
// actions are stubbed as ../page.test.tsx and the board-screen tests stub them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dev/ui/board",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../components/shell/appearance-actions", () => ({
  setThemePreference: vi.fn(),
  setCatsPreference: vi.fn(),
}));

import BoardPreviewPage from "./page";
import { BOARD_FIXTURE_CARDS, BOARD_FIXTURE_REPOSITORIES } from "../fixtures/board";
import { PREVIEW_LABEL } from "../primitives-gallery";

const savedFlag = process.env.JUMPHOUR_UI_PREVIEW;

beforeEach(() => {
  delete process.env.JUMPHOUR_UI_PREVIEW;
});

afterEach(() => {
  if (savedFlag === undefined) delete process.env.JUMPHOUR_UI_PREVIEW;
  else process.env.JUMPHOUR_UI_PREVIEW = savedFlag;
});

const params = (scenario?: string) => ({ searchParams: Promise.resolve(scenario === undefined ? {} : { scenario }) });

async function render(scenario?: string): Promise<string> {
  return renderToStaticMarkup(await BoardPreviewPage(params(scenario)));
}

/** The digest of the not-found error the page rejects with, or undefined if it rendered. */
async function notFoundDigest(): Promise<string | undefined> {
  try {
    await BoardPreviewPage(params("populated"));
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
}

/** The scenario the preview label names. */
const displayedScenario = (html: string) => /data-preview-scenario="([^"]+)"/.exec(html)?.[1];

describe("BoardPreviewPage", () => {
  it("responds as not found while JUMPHOUR_UI_PREVIEW is unset", async () => {
    expect(await notFoundDigest()).toMatch(/404/);
  });

  it.each(["true", "yes", "0", " 1 ", ""])("responds as not found when JUMPHOUR_UI_PREVIEW is %j", async (flag) => {
    process.env.JUMPHOUR_UI_PREVIEW = flag;
    expect(await notFoundDigest()).toMatch(/404/);
  });

  it("renders the populated fixture board under the preview label when JUMPHOUR_UI_PREVIEW is 1", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    const html = await render();

    expect(html).toContain(PREVIEW_LABEL);
    expect(displayedScenario(html)).toBe("populated");
    expect(html).toContain('data-shell-region="app-shell"');
    for (const card of BOARD_FIXTURE_CARDS) expect(html).toContain(card.title);
    for (const repository of BOARD_FIXTURE_REPOSITORIES) expect(html).toContain(repository.fullName);
    expect(html).toContain("Listening every 5 min");
  });

  it.each([
    ["does-not-exist", "populated"],
    ["Loading", "loading"],
    [" loading ", "loading"],
    ["SOURCE-ERROR", "source-error"],
  ])("names scenario %j as %s", async (raw, expected) => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    expect(displayedScenario(await render(raw))).toBe(expected);
  });

  it("shows the loading scenario as busy lanes under their real headers", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    const html = await render("loading");
    expect(html.match(/data-lane-pending/g)).toHaveLength(4);
    expect(html).toContain("Reconciling OpenSpec artifacts…");
    expect(html).toContain("Last heard 2 min ago");
  });

  it("shows the source-error scenario's delayed listeners with every card still on the board", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    const html = await render("source-error");
    expect(html).toContain("Listening delayed · retrying");
    expect(html).toContain("Last successful listen 48 min ago");
    for (const card of BOARD_FIXTURE_CARDS) expect(html).toContain(card.title);
  });

  it("opens the filtered-empty scenario filtered to Jira in acme/mobile-shell", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    const html = await render("filtered-empty");
    expect(html).toContain("No Jira ideas match this repository");
    expect(html).toContain("Reset filters");
    expect(html).toContain("Offline queue for shell telemetry");
    expect(html).not.toContain("Support request-level idempotency keys");
  });

  it("shows the empty scenario's first-use state with no fixture cards", async () => {
    process.env.JUMPHOUR_UI_PREVIEW = "1";
    const html = await render("empty");
    expect(html).toContain("No ideas on this board yet");
    for (const card of BOARD_FIXTURE_CARDS) expect(html).not.toContain(card.title);
  });
});
