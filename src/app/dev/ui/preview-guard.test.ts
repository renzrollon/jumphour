// Task 10.2 (design.md Decision 9): the preview guard takes Next's not-found
// path when previews are disabled and returns normally when enabled. Uses the
// real `notFound()` — the thrown value is Next's own not-found signal, which
// `isNotFoundError`-style checks recognise by its 404 digest.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { previewGuard } from "./preview-guard";

function notFoundDigest(fn: () => void): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
}

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.JUMPHOUR_UI_PREVIEW;
  delete process.env.JUMPHOUR_UI_PREVIEW;
});

afterEach(() => {
  if (saved === undefined) delete process.env.JUMPHOUR_UI_PREVIEW;
  else process.env.JUMPHOUR_UI_PREVIEW = saved;
});

describe("previewGuard", () => {
  it("triggers the not-found path for a disabled environment", () => {
    expect(notFoundDigest(() => previewGuard({ uiPreviewEnabled: false }))).toMatch(/404/);
  });

  it("returns normally for an enabled environment", () => {
    expect(previewGuard({ uiPreviewEnabled: true })).toBeUndefined();
  });

  it("reads the flag from the environment when called with no argument", () => {
    expect(notFoundDigest(() => previewGuard())).toMatch(/404/);

    process.env.JUMPHOUR_UI_PREVIEW = "true";
    expect(notFoundDigest(() => previewGuard())).toMatch(/404/);

    process.env.JUMPHOUR_UI_PREVIEW = "1";
    expect(() => previewGuard()).not.toThrow();
  });
});
