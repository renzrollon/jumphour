// @vitest-environment jsdom
// Task 5.6 (specs/workflow-board/spec.md "Present the board as four fixed
// lanes", edge case "a user tries to place a card manually"; card anatomy
// "Cards MUST NOT show ... drag handles, or status controls"): the board
// exposes no manual placement. Rendered over every preview scenario, nothing
// under the board carries a `draggable` attribute, a drag handle, or a status
// control, before and after a card is selected. React drag handlers leave no
// trace in the DOM, so the board sources are also scanned for drag wiring.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isTestFile, listFiles, readSource, repoPath, stripComments } from "../../../source-scan.testing";
import { BOARD_SCENARIOS, boardScenario } from "../../dev/ui/fixtures/board";
import { BoardScreen } from "./board-screen";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

afterEach(() => {
  cleanup();
  navigation.search = "";
  navigation.replace.mockReset();
});

const BOARD_DIR = dirname(fileURLToPath(import.meta.url));

/** Words a drag handle or grip names itself with, in any attribute. */
const DRAG_HANDLE = /drag|grip|handle|reorder|sortable/i;
/** What a status or placement control would call itself. */
const STATUS_CONTROL = /\b(?:status|move|mark as|set (?:lane|column|stage)|change (?:lane|column|stage))\b/i;
const INTERACTIVE =
  "button, a[href], input, select, textarea, [contenteditable], [tabindex], [role=button], [role=combobox], [role=listbox], [role=option], [role=menu], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=radio], [role=radiogroup], [role=slider], [role=switch], [role=checkbox]";

function accessibleText(element: Element): string {
  return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent].filter(Boolean).join(" ");
}

function assertNoManualPlacement(root: HTMLElement) {
  expect(root.querySelectorAll("[draggable]")).toHaveLength(0);

  for (const element of root.querySelectorAll("*")) {
    for (const attribute of element.getAttributeNames()) {
      if (attribute === "class" || attribute.startsWith("aria-") || attribute === "title" || attribute.startsWith("data-")) {
        expect(`${attribute}=${element.getAttribute(attribute)}`).not.toMatch(DRAG_HANDLE);
      }
    }
  }

  for (const control of root.querySelectorAll(INTERACTIVE)) {
    expect(accessibleText(control)).not.toMatch(STATUS_CONTROL);
  }

  const cards = root.querySelectorAll("article[data-card-id]");
  for (const card of cards) {
    // The card's one control is its select button; nothing else on it acts.
    const controls = [...card.querySelectorAll(INTERACTIVE)];
    expect(controls).toHaveLength(1);
    expect(controls[0].tagName).toBe("BUTTON");
    expect(controls[0].hasAttribute("aria-pressed")).toBe(true);
  }
  return cards.length;
}

describe("the board exposes no manual placement", () => {
  it.each(BOARD_SCENARIOS)("scenario %s", async (name) => {
    const scenario = boardScenario(name);
    const { container } = render(<BoardScreen view={scenario.view} pending={scenario.pending} />);

    const cardCount = assertNoManualPlacement(container);
    if (name === "populated") expect(cardCount).toBeGreaterThan(0);

    const firstCard = container.querySelector<HTMLButtonElement>("article[data-card-id] button[aria-pressed]");
    if (firstCard !== null) {
      await userEvent.setup().click(firstCard);
      expect(firstCard.getAttribute("aria-pressed")).toBe("true");
      assertNoManualPlacement(container);
    }
  });

  it("board components wire no drag-and-drop", () => {
    const offenders = listFiles(BOARD_DIR)
      .filter((file) => !isTestFile(file))
      .flatMap((file) => {
        const code = stripComments(readSource(file));
        const hits = code.match(/\bdraggable\b|\bonDrag\w*|\bonDrop\b|\bdataTransfer\b|\buseDrag\b|\buseDrop\b|dnd-kit|react-beautiful-dnd|react-dnd/g) ?? [];
        return hits.map((hit) => `${repoPath(file)}: ${hit}`);
      });
    expect(offenders).toEqual([]);
  });
});
