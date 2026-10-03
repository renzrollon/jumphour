// @vitest-environment jsdom
// design-system-and-app-shell task 11.2 (specs/design-system/spec.md "Never
// convey state by color alone"): every tone-bearing primitive pairs its tone
// indicator with text naming the state. The indicator itself is hidden from
// assistive technology, the text survives a rendering with no color at all,
// and two states that share one tone differ in their text and nothing else.
// The first case enumerates the primitives, so a component that adopts a tone
// later has to join this sweep.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardViewModel } from "../../../lib/board/board-view-model";
import { isTestFile, listFiles, readSource, stripComments } from "../../../source-scan.testing";
import { BoardCard } from "../board/board-card";
import { Badge } from "./badge";
import { Banner, type BannerTone } from "./banner";
import { SOURCE_KINDS, SOURCE_LABELS, SourceBadge } from "./source-badge";
import { TextField } from "./text-field";
import { ToneDot, type Tone } from "./tone-dot";

afterEach(() => {
  cleanup();
});

const COMPONENTS_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..") + sep;

const TONES: readonly Tone[] = ["neutral", "ok", "warn", "bad", "accent"];
const BANNER_TONES: readonly BannerTone[] = ["neutral", "ok", "warn", "bad"];

const STATE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "Not checked yet",
  ok: "Healthy",
  warn: "Delayed",
  bad: "Failed",
  accent: "Needs review",
};

/** What assistive technology announces: the text outside every aria-hidden subtree. */
function announced(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The same element as a monochrome rendering sees it: no class, no style, no SVG paint. */
function withoutColor(element: Element): Element {
  const copy = element.cloneNode(true) as Element;
  for (const node of [copy, ...copy.querySelectorAll("*")]) {
    for (const attribute of ["class", "style", "fill", "stroke", "color"]) node.removeAttribute(attribute);
  }
  return copy;
}

/** The element's markup with every text node emptied, so only the non-text presentation remains. */
function withoutText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  const walker = copy.ownerDocument.createTreeWalker(copy, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) node.textContent = "";
  return copy.outerHTML;
}

function renderOne(element: ReactElement): Element {
  const { container } = render(element);
  expect(container.children).toHaveLength(1);
  return container.firstElementChild!;
}

/**
 * Asserts the tone indicators inside `root` — icons and empty dot spans — are
 * hidden, and that the state is still named in text with color removed.
 */
function expectNamedState(root: Element, name: string) {
  const indicators = root.querySelectorAll("svg, span:empty");
  for (const indicator of indicators) {
    expect(indicator.closest('[aria-hidden="true"]'), indicator.outerHTML).not.toBeNull();
  }
  expect(announced(root)).toContain(name);
  expect(announced(withoutColor(root))).toBe(announced(root));
}

describe("never convey state by color alone", () => {
  it("covers every tone-bearing component", () => {
    const toneBearing = listFiles(COMPONENTS_ROOT, /\.tsx$/)
      .filter((file) => !isTestFile(file))
      .filter((file) => /\bToneDot\b|\btone\??\s*:/.test(stripComments(readSource(file))))
      .map((file) => file.slice(COMPONENTS_ROOT.length));
    expect(toneBearing).toEqual([
      join("board", "board-card.tsx"),
      join("ui", "badge.tsx"),
      join("ui", "banner.tsx"),
      join("ui", "tone-dot.tsx"),
    ]);
  });

  describe("ToneDot", () => {
    it.each(TONES)("renders the %s dot as hidden decoration with no text of its own", (tone) => {
      const dot = renderOne(<ToneDot tone={tone} />);
      expect(dot.getAttribute("aria-hidden")).toBe("true");
      expect(dot.textContent).toBe("");
    });
  });

  describe("Badge", () => {
    it.each(TONES)("names the %s state in text beside its hidden dot", (tone) => {
      const badge = renderOne(<Badge tone={tone}>{STATE_LABELS[tone]}</Badge>);
      expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expectNamedState(badge, STATE_LABELS[tone]);
      expect(announced(badge)).toBe(STATE_LABELS[tone]);
    });

    it("cannot be built without its text", () => {
      // @ts-expect-error — the label is required; a badge is never a bare colored dot.
      const unlabeled = <Badge tone="warn" />;
      expect(unlabeled).toBeDefined();
    });
  });

  describe("Banner", () => {
    it.each(BANNER_TONES)("names the %s state in its title beside a hidden tone icon", (tone) => {
      const title = `Source ${STATE_LABELS[tone].toLowerCase()}`;
      const banner = renderOne(<Banner tone={tone} title={title} />);
      expect(banner.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expectNamedState(banner, title);
      expect(banner.getAttribute("role")).toBe(tone === "bad" ? "alert" : "status");
    });

    it("cannot be built without its title", () => {
      // @ts-expect-error — the title is required; a banner is never a bare colored bar.
      const untitled = <Banner tone="bad" />;
      expect(untitled).toBeDefined();
    });
  });

  describe("SourceBadge", () => {
    it.each(SOURCE_KINDS)("names the %s source in text, not only by its accent", (source) => {
      const badge = renderOne(<SourceBadge source={source} />);
      expectNamedState(badge, SOURCE_LABELS[source]);
      expect(announced(badge)).toBe(SOURCE_LABELS[source]);
    });
  });

  describe("TextField", () => {
    it("states an invalid value in text, not only by its error border", () => {
      const field = renderOne(<TextField label="Change name" error="Use lowercase letters and dashes." />);
      const input = field.querySelector("input")!;
      expect(input.getAttribute("aria-invalid")).toBe("true");
      const message = field.querySelector(`#${CSS.escape(input.getAttribute("aria-describedby")!)}`);
      expect(message?.textContent).toBe("Use lowercase letters and dashes.");
      expectNamedState(field, "Use lowercase letters and dashes.");
    });
  });

  describe("BoardCard", () => {
    const GENERATED_AT = "2026-09-15T09:30:00.000Z";
    const card = (tone: Tone, text: string): CardViewModel => ({
      id: `card-${tone}`,
      laneId: "pr-mr",
      source: { kind: "github-issue", key: "PR #476" },
      title: "Harden shell deep-link parsing",
      changeName: null,
      repository: null,
      owner: null,
      relevance: null,
      freshness: { kind: "fetched", at: GENERATED_AT },
      evidence: { tone, text },
      agentNote: null,
      footer: "Opened Sep 8",
      externalHostLabel: "github.com",
    });

    it.each(TONES)("states the %s evidence in text beside its hidden dot", (tone) => {
      const article = renderOne(<BoardCard card={card(tone, STATE_LABELS[tone])} generatedAt={GENERATED_AT} selected={false} />);
      const evidence = article.querySelector("[data-evidence-tone]")!;
      expect(evidence.getAttribute("data-evidence-tone")).toBe(tone);
      expect(evidence.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expectNamedState(evidence, STATE_LABELS[tone]);
      expect(announced(evidence)).toBe(STATE_LABELS[tone]);
    });
  });

  it("keeps every state distinguishable with color removed", () => {
    const badges = TONES.map((tone) => announced(withoutColor(renderOne(<Badge tone={tone}>{STATE_LABELS[tone]}</Badge>))));
    const banners = BANNER_TONES.map((tone) =>
      announced(withoutColor(renderOne(<Banner tone={tone} title={`Source ${STATE_LABELS[tone].toLowerCase()}`} />))),
    );
    const sources = SOURCE_KINDS.map((source) => announced(withoutColor(renderOne(<SourceBadge source={source} />))));
    for (const texts of [badges, banners, sources]) expect(new Set(texts).size).toBe(texts.length);
  });

  it.each([
    [
      "badges",
      <Badge tone="warn">Stale snapshot</Badge>,
      <Badge tone="warn">Delayed listener</Badge>,
    ],
    [
      "banners",
      <Banner tone="warn" title="The snapshot is stale." />,
      <Banner tone="warn" title="The listener is delayed." />,
    ],
  ])("keeps two %s that share one tone distinct by their text alone", (_label, first, second) => {
    const a = renderOne(first);
    const b = renderOne(second);
    expect(announced(a)).not.toBe(announced(b));
    expect(withoutText(a)).toBe(withoutText(b));
  });
});
