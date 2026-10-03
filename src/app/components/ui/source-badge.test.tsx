// @vitest-environment jsdom
// Task 5.6: specs/design-system/spec.md "Label every source badge with text".
// The four sources read GitHub, GitLab, Jira · MCP and Manual; each accent is
// applied only within the badge element; and the badge is still identifiable
// with its accent class stripped.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCssRules } from "../../css-rules.testing";
import { SOURCE_KINDS, SOURCE_LABELS, SourceBadge, type SourceKind } from "./source-badge";

afterEach(() => {
  cleanup();
});

const css = parseCssRules(readFileSync(join(import.meta.dirname, "source-badge.module.css"), "utf8"));
const ACCENT_SELECTORS = [".github", ".gitlab", ".jira", ".manual"];

function renderRow(source: SourceKind) {
  return render(
    <article data-testid="card">
      <p>Card title</p>
      <SourceBadge source={source} />
    </article>,
  );
}

describe("SourceBadge", () => {
  it("covers exactly the four sources with their text labels", () => {
    expect([...SOURCE_KINDS]).toEqual(["github", "gitlab", "jira-mcp", "manual"]);
    expect(SOURCE_LABELS).toEqual({
      github: "GitHub",
      gitlab: "GitLab",
      "jira-mcp": "Jira · MCP",
      manual: "Manual",
    });
  });

  it("renders the four labels as visible text", () => {
    render(
      <>
        {SOURCE_KINDS.map((kind) => (
          <SourceBadge key={kind} source={kind} />
        ))}
      </>,
    );
    for (const label of ["GitHub", "GitLab", "Jira · MCP", "Manual"]) {
      expect(screen.getByText(label, { exact: true })).not.toBeNull();
    }
  });

  it("rejects a source outside the closed union at compile time", () => {
    // @ts-expect-error — "jira" alone is not a source kind; Jira is reached through MCP.
    const invalid = <SourceBadge source="jira" />;
    expect(invalid).toBeTruthy();
  });

  it.each(SOURCE_KINDS)("applies the %s accent only on the badge element", (kind) => {
    const { getByTestId } = renderRow(kind);
    const card = getByTestId("card");
    const badge = screen.getByText(SOURCE_LABELS[kind], { exact: true });
    const accentClass = badge.className.split(" ").find((name) => name !== badge.className.split(" ")[0]);
    expect(accentClass).toBeTruthy();
    // The accent class lives on the badge and nowhere else in the row.
    expect(card.querySelectorAll(`.${CSS.escape(accentClass!)}`)).toHaveLength(1);
    expect(card.className).toBe("");
    for (const el of card.querySelectorAll("*")) {
      if (el !== badge) expect(el.className).toBe("");
    }
  });

  it("scopes every accent rule to the badge element itself", () => {
    const accentRules = css.filter((rule) => ACCENT_SELECTORS.some((sel) => rule.selector.includes(sel)));
    expect(accentRules.map((rule) => rule.selector).sort()).toEqual([...ACCENT_SELECTORS].sort());
    for (const rule of accentRules) {
      // A lone class: no descendant, child, sibling, :has(), or ancestor reach.
      expect(rule.selector).toMatch(/^\.[A-Za-z]+$/);
      const props = rule.declarations.map(([prop]) => prop).sort();
      expect(props).toEqual(["background", "color"]);
    }
    // No rule anywhere in the module reaches outside a single class.
    for (const rule of css) expect(rule.selector).toMatch(/^\.[A-Za-z]+$/);
  });

  it.each(SOURCE_KINDS)("stays identifiable as %s with its accent class stripped", (kind) => {
    renderRow(kind);
    const badge = screen.getByText(SOURCE_LABELS[kind], { exact: true });
    const [baseClass] = badge.className.split(" ");
    badge.className = baseClass!;
    expect(badge.textContent).toBe(SOURCE_LABELS[kind]);
    expect(badge.getAttribute("data-source")).toBe(kind);
    expect(badge.getAttribute("aria-hidden")).toBeNull();
    badge.removeAttribute("class");
    expect(screen.getByText(SOURCE_LABELS[kind], { exact: true })).toBe(badge);
  });

  it("gives the badge an outline under forced colors so its shape survives without color", () => {
    const forced = css.filter((rule) => rule.atRules.includes("@media (forced-colors: active)"));
    expect(forced).toHaveLength(1);
    expect(forced[0]!.selector).toBe(".badge");
  });
});
