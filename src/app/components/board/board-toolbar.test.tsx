// @vitest-environment jsdom
// Task 4.1 (specs/workflow-board/spec.md "Filter the board by repository,
// source, and owner"): repository options come from the view's repositories,
// one per githubRepoId; source options are the four labelled sources; the
// owner filter lists the owners on the cards plus "No owner", and is not
// rendered when no card has an owner.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CardViewModel, RepositoryRef } from "../../../lib/board/board-view-model";
import { NO_FILTERS, type BoardFilters } from "../../../lib/board/filter-cards";
import { BoardToolbar } from "./board-toolbar";

afterEach(() => {
  cleanup();
});

const GATEWAY: RepositoryRef = { githubRepoId: 101, fullName: "acme/api-gateway" };
const WEB: RepositoryRef = { githubRepoId: 202, fullName: "acme/customer-web" };

function card(id: string, owner: string | null): CardViewModel {
  return {
    id,
    laneId: "idea",
    source: { kind: "manual", key: null },
    title: `Card ${id}`,
    changeName: null,
    repository: null,
    owner: owner === null ? null : { displayName: owner },
    relevance: null,
    freshness: { kind: "composed", at: "2026-09-24T12:00:00.000Z" },
    evidence: { tone: "neutral", text: "Created in Jumphour" },
    agentNote: null,
    footer: "",
    externalHostLabel: null,
  };
}

function Harness({
  repositories,
  cards,
  onFiltersChange,
}: {
  repositories: RepositoryRef[];
  cards: CardViewModel[];
  onFiltersChange: (next: BoardFilters) => void;
}) {
  const [filters, setFilters] = useState<BoardFilters>(NO_FILTERS);
  return (
    <BoardToolbar
      repositories={repositories}
      cards={cards}
      filters={filters}
      onFiltersChange={(next) => {
        onFiltersChange(next);
        setFilters(next);
      }}
    />
  );
}

const optionLabels = (label: string) =>
  Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.textContent);

describe("BoardToolbar filters — populated", () => {
  const cards = [card("1", "Mei Lin"), card("2", "  Dana Okafor "), card("3", null), card("4", "Mei Lin")];
  // One repository listed twice under two names (a rename) must appear once.
  const repositories = [GATEWAY, WEB, { githubRepoId: 101, fullName: "acme/gateway" }];

  it("lists each repository once by githubRepoId, after All repositories", () => {
    render(<Harness repositories={repositories} cards={cards} onFiltersChange={() => {}} />);
    expect(optionLabels("Repository scope")).toEqual(["All repositories", "acme/api-gateway", "acme/customer-web"]);
  });

  it("lists All sources and the four labelled sources", () => {
    render(<Harness repositories={repositories} cards={cards} onFiltersChange={() => {}} />);
    expect(optionLabels("Source filter")).toEqual(["All sources", "GitHub", "GitLab", "Jira · MCP", "Manual"]);
  });

  it("lists the distinct owners on the cards plus No owner", () => {
    render(<Harness repositories={repositories} cards={cards} onFiltersChange={() => {}} />);
    expect(optionLabels("Owner filter")).toEqual(["Any owner", "Dana Okafor", "Mei Lin", "No owner"]);
  });

  it("reports each choice as the canonical filter value", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<Harness repositories={repositories} cards={cards} onFiltersChange={onFiltersChange} />);

    await user.selectOptions(screen.getByLabelText("Repository scope"), "acme/customer-web");
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, repositoryId: 202 });

    await user.selectOptions(screen.getByLabelText("Source filter"), "Jira · MCP");
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, repositoryId: 202, source: "jira" });

    await user.selectOptions(screen.getByLabelText("Owner filter"), "No owner");
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...NO_FILTERS,
      repositoryId: 202,
      source: "jira",
      owner: "No owner",
    });

    await user.selectOptions(screen.getByLabelText("Repository scope"), "All repositories");
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, source: "jira", owner: "No owner" });
  });
});

describe("BoardToolbar filters — ownerless", () => {
  it("renders no owner filter when no card has an owner", () => {
    render(
      <Harness repositories={[GATEWAY]} cards={[card("1", null), card("2", "   ")]} onFiltersChange={() => {}} />,
    );
    expect(screen.queryByLabelText("Owner filter")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("No owner");
    expect(document.body.textContent).not.toContain("Unassigned");
  });

  it("renders no owner filter on an empty board", () => {
    render(<Harness repositories={[]} cards={[]} onFiltersChange={() => {}} />);
    expect(screen.queryByLabelText("Owner filter")).toBeNull();
    expect(optionLabels("Repository scope")).toEqual(["All repositories"]);
  });
});
