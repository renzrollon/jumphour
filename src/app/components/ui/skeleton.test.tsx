// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCssRules, type CssRule } from "../../css-rules.testing";
import { Skeleton } from "./skeleton";

const REDUCED = "@media (prefers-reduced-motion: reduce)";

afterEach(() => {
  cleanup();
});

describe("Skeleton", () => {
  it("announces what is loading through a status region", () => {
    render(<Skeleton label="Loading ideas" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe("Loading ideas");
  });

  it("hides its shimmering placeholder blocks from assistive technology", () => {
    render(<Skeleton label="Loading ideas" rows={3} />);
    const status = screen.getByRole("status");
    const hiddenBlocks = status.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenBlocks).toHaveLength(3);
  });

  it("shows its label above the blocks at every motion setting when labelVisible is set", () => {
    render(<Skeleton label="Reconciling OpenSpec artifacts…" rows={2} labelVisible />);
    const status = screen.getByRole("status", { name: "Reconciling OpenSpec artifacts…" });
    const caption = status.firstElementChild!;
    expect(caption.textContent).toBe("Reconciling OpenSpec artifacts…");
    expect(caption.getAttribute("aria-hidden")).toBeNull();
    expect(screen.getAllByText("Reconciling OpenSpec artifacts…")).toHaveLength(1);
    expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);

    const css = parseCssRules(readFileSync(join(import.meta.dirname, "skeleton.module.css"), "utf8"));
    const visible = css.filter((rule) => rule.selector === ".visibleLabel");
    expect(visible.every((rule) => rule.atRules.length === 0)).toBe(true);
    expect(visible[0]!.declarations.map(([property]) => property)).not.toContain("clip-path");
  });

  it("defaults to a single placeholder block", () => {
    render(<Skeleton label="Loading" />);
    expect(screen.getByRole("status").querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });
});

describe("Skeleton under reduced motion (task 5.7)", () => {
  const css = parseCssRules(readFileSync(join(import.meta.dirname, "skeleton.module.css"), "utf8"));
  const reduced = css.filter((rule) => rule.atRules.includes(REDUCED));
  const decl = (rule: CssRule | undefined, prop: string) => rule?.declarations.find(([p]) => p === prop)?.[1];

  it("still announces the loading state as a busy status carrying its text", () => {
    render(<Skeleton label="Loading ideas" rows={2} />);
    const status = screen.getByRole("status", { name: "Loading ideas" });
    expect(status.getAttribute("aria-busy")).toBe("true");
    const text = screen.getByText("Loading ideas");
    expect(status.contains(text)).toBe(true);
    expect(text.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("suppresses the shimmer and leaves a static placeholder shape", () => {
    const block = reduced.find((rule) => rule.selector === ".block");
    expect(decl(block, "animation")).toBe("none");
    // The block itself is not hidden: the placeholder shape stays visible.
    expect(decl(block, "display")).toBeUndefined();
    expect(decl(block, "visibility")).toBeUndefined();
  });

  it("shows the accompanying text visibly when motion is reduced", () => {
    const base = css.find((rule) => rule.selector === ".label" && rule.atRules.length === 0);
    expect(decl(base, "clip-path")).toBe("inset(50%)");
    const label = reduced.find((rule) => rule.selector === ".label");
    expect(decl(label, "position")).toBe("static");
    expect(decl(label, "clip-path")).toBe("none");
    expect(decl(label, "width")).toBe("auto");
    expect(decl(label, "height")).toBe("auto");
    expect(decl(label, "overflow")).toBe("visible");
  });

  it("hides nothing under reduced motion", () => {
    for (const rule of reduced) {
      expect(decl(rule, "display")).not.toBe("none");
      expect(decl(rule, "visibility")).not.toBe("hidden");
      expect(decl(rule, "opacity")).not.toBe("0");
    }
  });
});
