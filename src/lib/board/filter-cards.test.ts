import { describe, expect, it } from "vitest";
import type { CardViewModel } from "./board-view-model";
import { cardMatchesFilters, filtersActive, NO_FILTERS, normalizeQuery, ownerKey, type BoardFilters } from "./filter-cards";

function card(overrides: Partial<CardViewModel> & { id: string }): CardViewModel {
  return {
    laneId: "idea",
    source: { kind: "github-issue", key: "#814" },
    title: "Support request-level idempotency keys",
    changeName: null,
    repository: { githubRepoId: 1, fullName: "acme/api-gateway" },
    owner: { displayName: "Priya Nair" },
    relevance: null,
    freshness: { kind: "snapshot", at: "2026-09-24T11:46:00.000Z" },
    evidence: { tone: "neutral", text: "Captured from GitHub #814" },
    agentNote: null,
    footer: "Opened Sep 9",
    externalHostLabel: "github.com",
    ...overrides,
  };
}

const f = (partial: Partial<BoardFilters>): BoardFilters => ({ ...NO_FILTERS, ...partial });

const pay184 = card({
  id: "c2",
  source: { kind: "jira", key: "PAY-184" },
  title: "Give finance export failures an actionable retry path",
  repository: { githubRepoId: 2, fullName: "acme/customer-web" },
  evidence: { tone: "neutral", text: "Captured via MCP" },
});

describe("normalizeQuery", () => {
  it("applies NFKC, trims, collapses internal whitespace, and lowercases", () => {
    expect(normalizeQuery("  Foo \t  BAR\n baz ")).toBe("foo bar baz");
    expect(normalizeQuery("ＰＡＹ-１８４")).toBe("pay-184");
  });
});

describe("search", () => {
  it("matches pay-184, '  PAY-184  ', and the full-width ＰＡＹ-１８４ to the same card", () => {
    for (const query of ["pay-184", "  PAY-184  ", "ＰＡＹ-１８４"]) {
      expect(cardMatchesFilters(pay184, f({ query }))).toBe(true);
      expect(cardMatchesFilters(card({ id: "c1" }), f({ query }))).toBe(false);
    }
  });

  it("matches title, change name, and evidence text", () => {
    const c = card({ id: "c5", changeName: "add-idempotency-keys" });
    expect(cardMatchesFilters(c, f({ query: "IDEMPOTENCY" }))).toBe(true);
    expect(cardMatchesFilters(c, f({ query: "add-idempotency" }))).toBe(true);
    expect(cardMatchesFilters(c, f({ query: "captured from" }))).toBe(true);
  });

  it("does not match across a field boundary", () => {
    const c = card({ id: "c1", title: "alpha", source: { kind: "manual", key: null }, evidence: { tone: "neutral", text: "beta" } });
    expect(cardMatchesFilters(c, f({ query: "alpha beta" }))).toBe(false);
  });
});

describe("filtersActive", () => {
  it("treats a whitespace-only query as inactive, and it hides no card", () => {
    const filters = f({ query: "   \t " });
    expect(filtersActive(filters)).toBe(false);
    expect(cardMatchesFilters(pay184, filters)).toBe(true);
  });

  it("is active for a real query or any selected filter", () => {
    expect(filtersActive(NO_FILTERS)).toBe(false);
    expect(filtersActive(f({ query: " x " }))).toBe(true);
    expect(filtersActive(f({ repositoryId: 1 }))).toBe(true);
    expect(filtersActive(f({ source: "manual" }))).toBe(true);
    expect(filtersActive(f({ owner: "No owner" }))).toBe(true);
  });
});

describe("repository filter", () => {
  it("compares githubRepoId, so two display names of one repository both match", () => {
    const oldName = card({ id: "a", repository: { githubRepoId: 7, fullName: "acme/gateway" } });
    const newName = card({ id: "b", repository: { githubRepoId: 7, fullName: "acme/api-gateway" } });
    const other = card({ id: "c", repository: { githubRepoId: 8, fullName: "acme/gateway" } });
    expect(cardMatchesFilters(oldName, f({ repositoryId: 7 }))).toBe(true);
    expect(cardMatchesFilters(newName, f({ repositoryId: 7 }))).toBe(true);
    expect(cardMatchesFilters(other, f({ repositoryId: 7 }))).toBe(false);
  });

  it("passes a card with repository: null under every repository filter", () => {
    const unbound = card({ id: "m", repository: null });
    for (const repositoryId of [1, 2, 999]) expect(cardMatchesFilters(unbound, f({ repositoryId }))).toBe(true);
  });
});

describe("combined filters", () => {
  it("ANDs source and repository", () => {
    const jiraRepo2 = pay184;
    const jiraRepo1 = card({ id: "j1", source: { kind: "jira", key: "PAY-9" } });
    const githubRepo2 = card({ id: "g2", repository: { githubRepoId: 2, fullName: "acme/customer-web" } });
    const filters = f({ source: "jira", repositoryId: 2 });
    expect(cardMatchesFilters(jiraRepo2, filters)).toBe(true);
    expect(cardMatchesFilters(jiraRepo1, filters)).toBe(false);
    expect(cardMatchesFilters(githubRepo2, filters)).toBe(false);
  });
});

describe("owner key and filter", () => {
  it("is displayName after NFC + trim, and 'No owner' for null", () => {
    expect(ownerKey({ displayName: "  Priya Nair " })).toBe("Priya Nair");
    expect(ownerKey({ displayName: "José" })).toBe("José");
    expect(ownerKey(null)).toBe("No owner");
  });

  it("filters by owner key, including 'No owner'", () => {
    const unowned = card({ id: "u", owner: null });
    expect(cardMatchesFilters(card({ id: "p" }), f({ owner: "Priya Nair" }))).toBe(true);
    expect(cardMatchesFilters(unowned, f({ owner: "Priya Nair" }))).toBe(false);
    expect(cardMatchesFilters(unowned, f({ owner: "No owner" }))).toBe(true);
  });
});
