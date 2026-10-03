// @vitest-environment jsdom
// Task 4.4 (specs/workflow-board/spec.md "Search cards across all lanes";
// design.md Decision 3): the search field is labelled "Search ideas, specs,
// PRs, and MRs", reports each edit, and renders inside the shell's search slot
// when the board passes it; a view that passes nothing (/repositories) leaves
// the slot empty.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "../shell/app-shell";
import { BOARD_SEARCH_LABEL, BoardSearch } from "./board-search";

afterEach(() => {
  cleanup();
});

function ControlledSearch({ onQuery }: { onQuery: (query: string) => void }) {
  const [query, setQuery] = useState("");
  return (
    <BoardSearch
      value={query}
      onChange={(next) => {
        onQuery(next);
        setQuery(next);
      }}
    />
  );
}

const searchSlot = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-shell-region="top-app-bar"] [data-shell-slot="search"]')!;

describe("BoardSearch", () => {
  it("is a labelled search field", () => {
    render(<BoardSearch value="" onChange={() => {}} />);
    expect(BOARD_SEARCH_LABEL).toBe("Search ideas, specs, PRs, and MRs");
    const field = screen.getByRole("searchbox", { name: BOARD_SEARCH_LABEL });
    expect(field.getAttribute("type")).toBe("search");
    expect(screen.getByRole("search")).not.toBeNull();
  });

  it("reports the raw text of each edit", async () => {
    const user = userEvent.setup();
    const onQuery = vi.fn();
    render(<ControlledSearch onQuery={onQuery} />);

    await user.type(screen.getByRole("searchbox", { name: BOARD_SEARCH_LABEL }), " PAY");
    expect(onQuery).toHaveBeenLastCalledWith(" PAY");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(" PAY");
  });
});

describe("the shell's search slot", () => {
  it("holds the search field on the board", () => {
    const { container } = render(
      <AppShell search={<BoardSearch value="" onChange={() => {}} />}>
        <p>board</p>
      </AppShell>,
    );
    const slot = searchSlot(container);
    expect(within(slot).getByRole("searchbox", { name: BOARD_SEARCH_LABEL })).not.toBeNull();
    expect(slot.getAttribute("aria-hidden")).toBeNull();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });

  it("is empty and hidden from assistive technology on /repositories", () => {
    const { container } = render(
      <AppShell>
        <p>repositories</p>
      </AppShell>,
    );
    const slot = searchSlot(container);
    expect(slot.childElementCount).toBe(0);
    expect(slot.textContent).toBe("");
    expect(slot.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
