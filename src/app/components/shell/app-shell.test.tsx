// @vitest-environment jsdom
// Task 8.1 (specs/app-shell/spec.md "Frame every signed-in view in one top
// app bar", edge case "the content area scrolls"): the bar stays visible
// while the content below it scrolls. jsdom does not lay out or scroll a
// page, so "stays fixed while content scrolls" is verified the same way the
// rest of this suite verifies CSS contracts (tokens.test.ts, globals.test.ts,
// skeleton.test.tsx): by parsing the source stylesheet and asserting the
// declarations that produce that behavior, rather than by simulating a
// scroll jsdom cannot actually perform. The render assertions below confirm
// the bar sits once, above the scrollable content, in the DOM.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type CssRule, parseCssRules } from "../../css-rules.testing";
import { AppShell } from "./app-shell";

afterEach(() => {
  cleanup();
});

// `readCss`'s `new URL(path, import.meta.url)` form needs a real file:// URL;
// under the jsdom environment `import.meta.url` is not one (see
// skeleton.test.tsx and progress-indicator.test.tsx for the same
// jsdom-environment workaround), so this file reads directly instead.
const shellRules = parseCssRules(readFileSync(join(import.meta.dirname, "app-shell.module.css"), "utf8"));
const barRules = parseCssRules(readFileSync(join(import.meta.dirname, "top-app-bar.module.css"), "utf8"));

const decl = (rule: CssRule | undefined) => new Map(rule?.declarations ?? []);
const find = (rules: CssRule[], selector: string) => rules.find((r) => r.atRules.length === 0 && r.selector === selector);

describe("app-shell.module.css", () => {
  it("lays the frame out as a column so the bar sits above the scrollable content", () => {
    const frame = decl(find(shellRules, ".frame"));
    expect(frame.get("display")).toBe("flex");
    expect(frame.get("flex-direction")).toBe("column");
  });

  it("lets the content area grow and does not fix its height", () => {
    const content = decl(find(shellRules, ".content"));
    expect(content.get("flex")).toBe("1 1 auto");
    expect(content.has("height")).toBe(false);
    expect(content.has("overflow")).toBe(false);
  });
});

describe("top-app-bar.module.css", () => {
  it("pins the bar to the top of the viewport with position: sticky", () => {
    const bar = decl(find(barRules, ".bar"));
    expect(bar.get("position")).toBe("sticky");
    expect(bar.get("top")).toBe("0");
  });
});

describe("AppShell", () => {
  it("renders the top app bar once, above the scrollable content", () => {
    const { container } = render(
      <AppShell>
        <p data-testid="page-content">Content</p>
      </AppShell>,
    );
    const headers = container.querySelectorAll("header");
    expect(headers).toHaveLength(1);
    expect(headers[0]!.className).toContain("bar");

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.querySelector('[data-testid="page-content"]')).not.toBeNull();

    // The bar precedes the content in source order, so it is what the
    // browser paints first and keeps pinned as the content scrolls past it.
    const frame = container.querySelector('[data-shell-region="app-shell"]');
    const children = Array.from(frame!.children);
    expect(children[0]!.tagName).toBe("HEADER");
    expect(children[1]!.tagName).toBe("MAIN");
  });

  it("does not render a second top app bar even when content below is tall", () => {
    const { container } = render(
      <AppShell>
        <div style={{ height: "4000px" }}>Tall content</div>
      </AppShell>,
    );
    expect(container.querySelectorAll('[data-shell-region="top-app-bar"]')).toHaveLength(1);
  });
});
