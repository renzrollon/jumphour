// @vitest-environment jsdom
// Task 3.2 (specs/workflow-board/spec.md "Present cards with a consistent,
// evidence-first anatomy": "title contains markup" and "very long title"):
// in a live DOM, a title carrying markup creates no element and requests
// nothing, and a 400-character title — clamped to three lines only by CSS —
// is the button's full accessible name.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CardViewModel } from "../../../lib/board/board-view-model";
import { BoardCard } from "./board-card";

afterEach(() => {
  cleanup();
});

const GENERATED_AT = "2026-09-24T12:00:00.000Z";

const card: CardViewModel = {
  id: "card-1",
  laneId: "idea",
  source: { kind: "github-issue", key: "#901" },
  title: "placeholder",
  changeName: null,
  repository: { githubRepoId: 701, fullName: "acme/api-gateway" },
  owner: null,
  relevance: null,
  freshness: { kind: "snapshot", at: "2026-09-24T11:50:00.000Z" },
  evidence: { tone: "neutral", text: "Captured from GitHub #901" },
  agentNote: null,
  footer: "Idea",
  externalHostLabel: "github.com",
};

describe("BoardCard in the DOM", () => {
  it("shows a title containing markup as literal text and creates no element from it", () => {
    const title = "<img src=x onerror=alert(1)> Fix login";
    const { container } = render(<BoardCard card={{ ...card, title }} generatedAt={GENERATED_AT} selected={false} />);

    const button = screen.getByRole("button", { name: title });
    expect(button.textContent).toBe(title);
    expect(button.children).toHaveLength(0);
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("keeps a 400-character title whole in the button's accessible name", () => {
    const title = Array.from({ length: 45 }, (_, i) => `word${String(i).padStart(4, "0")} `).join("").slice(0, 400);
    expect(title).toHaveLength(400);
    render(<BoardCard card={{ ...card, title }} generatedAt={GENERATED_AT} selected={false} />);

    const button = screen.getByRole("button", { name: title });
    expect(button.textContent).toBe(title);
    expect(button.getAttribute("aria-label")).toBeNull();
    expect(button.getAttribute("aria-labelledby")).toBeNull();
  });
});
