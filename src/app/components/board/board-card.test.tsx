// Task 3.1 (specs/workflow-board/spec.md "Present cards with a consistent,
// evidence-first anatomy"; design.md Decision 5): the card is an article with
// a heading whose stretched button carries aria-pressed, renders every part
// of the anatomy when present, and omits absent optionals instead of
// inventing them.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCssRules } from "../../css-rules.testing";
import { isTestFile, listFiles, readSource, repoPath, stripComments } from "../../../source-scan.testing";
import type { CardViewModel } from "../../../lib/board/board-view-model";
import { BoardCard } from "./board-card";

const GENERATED_AT = "2026-09-24T12:00:00.000Z";
const minutesBefore = (n: number) => new Date(Date.parse(GENERATED_AT) - n * 60_000).toISOString();

/** Visible and announced text, tags removed. */
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const githubCard: CardViewModel = {
  id: "card-814",
  laneId: "idea",
  source: { kind: "github-issue", key: "#814" },
  title: "Retry webhook deliveries on 5xx",
  changeName: null,
  repository: { githubRepoId: 701, fullName: "acme/api-gateway" },
  owner: { displayName: "Priya Nair" },
  relevance: "Platform reliability",
  freshness: { kind: "snapshot", at: minutesBefore(14) },
  evidence: { tone: "neutral", text: "Captured from GitHub #814" },
  agentNote: "Drafted with agent assistance",
  footer: "Idea",
  externalHostLabel: "github.com",
};

const manualCard: CardViewModel = {
  id: "card-manual-1",
  laneId: "idea",
  source: { kind: "manual", key: null },
  title: "Sketch onboarding checklist",
  changeName: null,
  repository: null,
  owner: null,
  relevance: null,
  freshness: { kind: "composed", at: minutesBefore(3) },
  evidence: { tone: "neutral", text: "Created in Jumphour" },
  agentNote: null,
  footer: "Idea",
  externalHostLabel: null,
};

describe("BoardCard", () => {
  it("renders article > h3 > aria-pressed button holding only the title", () => {
    const html = renderToStaticMarkup(<BoardCard card={githubCard} generatedAt={GENERATED_AT} selected={false} />);

    expect(html.startsWith("<article")).toBe(true);
    const button = html.match(/<h3[^>]*><button([^>]*)>([^<]*)<\/button><\/h3>/);
    expect(button).not.toBeNull();
    expect(button![1]).toContain('aria-pressed="false"');
    expect(button![2]).toBe("Retry webhook deliveries on 5xx");
  });

  it("describes the button by the badge/key row", () => {
    const html = renderToStaticMarkup(<BoardCard card={githubCard} generatedAt={GENERATED_AT} selected />);

    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    const row = html.match(new RegExp(`<div[^>]*id="${describedBy}"[^>]*>(.*?)</div>`));
    expect(row).not.toBeNull();
    expect(text(row![1]!)).toBe("GitHub #814 Snapshot 14 min ago");
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the full anatomy in order when every value is present", () => {
    const html = renderToStaticMarkup(<BoardCard card={githubCard} generatedAt={GENERATED_AT} selected={false} />);

    expect(text(html)).toBe(
      [
        "GitHub #814 Snapshot 14 min ago",
        "Retry webhook deliveries on 5xx",
        "acme/api-gateway PN Priya Nair Platform reliability",
        "Captured from GitHub #814",
        "Drafted with agent assistance",
        "Idea github.com",
      ].join(" "),
    );
  });

  it("omits key, repository, owner, and external host for a manual card, and invents nothing", () => {
    const html = renderToStaticMarkup(<BoardCard card={manualCard} generatedAt={GENERATED_AT} selected={false} />);

    expect(text(html)).toBe("Manual Composed 3 min ago Sketch onboarding checklist Created in Jumphour Idea");
    expect(html).not.toContain("Unassigned");
    expect(html).not.toContain("data-pair");
    expect(html).not.toContain("data-external-host");
    expect(html).not.toContain("#");
  });

  it("leads the evidence with a hidden tone dot, ends the host label with a hidden ↗, and sets the agent note in italic", () => {
    const html = renderToStaticMarkup(<BoardCard card={githubCard} generatedAt={GENERATED_AT} selected={false} />);

    const evidence = html.match(/<p[^>]*data-evidence-tone="([a-z]+)"[^>]*>(.*?)<\/p>/)!;
    expect(evidence[1]).toBe(githubCard.evidence.tone);
    expect(evidence[2]).toMatch(/^<span aria-hidden="true"[^>]*><\/span><span>/);
    const host = html.match(/<span[^>]*data-external-host=""[^>]*>(.*?)<\/span>/)!;
    expect(host[1]).toMatch(/^github\.com<svg[^>]*aria-hidden="true"/);

    const css = parseCssRules(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "board-card.module.css"), "utf8"));
    const agentNote = css.find((rule) => rule.selector === ".agentNote" && rule.atRules.length === 0);
    expect(Object.fromEntries(agentNote!.declarations)["font-style"]).toBe("italic");
  });

  // Task 3.2 (spec "Failure — title contains markup"): card strings are text nodes.
  it("renders a title containing markup as escaped literal text", () => {
    const title = "<img src=x onerror=alert(1)> Fix login";
    const html = renderToStaticMarkup(
      <BoardCard
        card={{ ...githubCard, title, agentNote: "<b>note</b>", evidence: { ...githubCard.evidence, text: "<script>x()</script>" } }}
        generatedAt={GENERATED_AT}
        selected={false}
      />,
    );

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; Fix login");
    expect(html).toContain("&lt;b&gt;note&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x()&lt;/script&gt;");
    expect(html).not.toMatch(/<img\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/<b>/);
  });

  // Task 3.2 (spec "Edge case — very long title"): the clamp is CSS only.
  it("clamps the title button to three lines in CSS", () => {
    const css = parseCssRules(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "board-card.module.css"), "utf8"));
    const select = css.find((rule) => rule.selector === ".select" && rule.atRules.length === 0);
    expect(select).toBeDefined();
    const declarations = Object.fromEntries(select!.declarations);
    expect(declarations["-webkit-line-clamp"]).toBe("3");
    expect(declarations["line-clamp"]).toBe("3");
    expect(declarations["-webkit-box-orient"]).toBe("vertical");
    expect(declarations["display"]).toBe("-webkit-box");
    expect(declarations["overflow"]).toBe("hidden");
  });

  it("keeps a 400-character title whole in the markup", () => {
    const title = "Long title ".repeat(40).slice(0, 400);
    expect(title).toHaveLength(400);
    const html = renderToStaticMarkup(<BoardCard card={{ ...githubCard, title }} generatedAt={GENERATED_AT} selected={false} />);

    const button = html.match(/<button([^>]*)>([^<]*)<\/button>/);
    expect(button![2]).toBe(title);
    expect(button![1]).not.toContain("aria-label");
  });

  // Task 3.2 (design.md Decision 5): no component under the board directory parses HTML.
  it("has no dangerouslySetInnerHTML under src/app/components/board/", () => {
    const boardDir = dirname(fileURLToPath(import.meta.url));
    const sources = listFiles(boardDir).filter((file) => !isTestFile(file));
    expect(sources.length).toBeGreaterThan(0);
    const offenders = sources.filter((file) => /dangerouslySetInnerHTML|__html/.test(stripComments(readSource(file)))).map(repoPath);
    expect(offenders).toEqual([]);
  });
});
