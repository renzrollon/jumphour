// @vitest-environment jsdom
// Task 5.1 (specs/workflow-board/spec.md "Filter the board by repository,
// source, and owner", happy path "filter to one repository"; "Search cards
// across all lanes"; design.md Decision 3): BoardScreen owns the filters and
// derives every lane's visible cards and count through filter-cards.ts.
// Filtering to one repository narrows every lane, keeps the unbound Idea card,
// and makes each lane count equal the cards the lane now shows.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BoardViewModel, CardViewModel, LaneId, LaneViewModel } from "../../../lib/board/board-view-model";
import { parseCssRules } from "../../css-rules.testing";
import { BOARD_SEARCH_LABEL } from "./board-search";
import cardStyles from "./board-card.module.css";
import boardStyles from "./board.module.css";
import { BoardScreen } from "./board-screen";

// Task 5.4: BoardScreen reads and writes `?card=` through next/navigation.
// Outside the App Router those hooks have no router, so the address is a
// stand-in: `navigation.search` is what `useSearchParams` reads, and
// `router.replace` records each address written.
const navigation = vi.hoisted(() => ({ search: "", pathname: "/", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

afterEach(() => {
  cleanup();
  navigation.search = "";
  navigation.pathname = "/";
  navigation.replace.mockReset();
});

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED_AT = "2026-09-24T12:00:00.000Z";
const API = { githubRepoId: 701, fullName: "acme/api-gateway" };
const WEB = { githubRepoId: 702, fullName: "acme/customer-web" };

function card(id: string, laneId: LaneId, title: string, repository: CardViewModel["repository"]): CardViewModel {
  return {
    id,
    laneId,
    source: repository === null ? { kind: "manual", key: null } : { kind: "github-issue", key: `#${id}` },
    title,
    changeName: null,
    repository,
    owner: null,
    relevance: null,
    freshness: { kind: "snapshot", at: GENERATED_AT },
    evidence: { tone: "neutral", text: repository === null ? "Created in Jumphour" : "Captured from GitHub" },
    agentNote: null,
    footer: "Card",
    externalHostLabel: null,
  };
}

function lane(id: LaneId, cards: CardViewModel[]): LaneViewModel {
  return { id, listener: { status: "not-configured" }, manualRead: null, cards };
}

const VIEW: BoardViewModel = {
  generatedAt: GENERATED_AT,
  installation: { installationId: 1, accountLogin: "acme" },
  repositories: [API, WEB],
  lanes: [
    lane("idea", [
      card("1", "idea", "Retry webhook deliveries", API),
      card("2", "idea", "Customer portal dark mode", WEB),
      card("3", "idea", "Sketch onboarding checklist", null),
    ]),
    lane("openspec-change", [card("4", "openspec-change", "Add idempotency keys", API), card("5", "openspec-change", "Split checkout form", WEB)]),
    lane("in-progress", [card("6", "in-progress", "Rate-limit partner API", API), card("7", "in-progress", "Invoice PDF export", WEB)]),
    lane("pr-mr", [card("8", "pr-mr", "Refresh billing emails", WEB)]),
  ],
  compose: { status: "unavailable", reason: "Idea intake is not enabled for this installation yet." },
};

const TITLES: Readonly<Record<LaneId, string>> = {
  idea: "Idea",
  "openspec-change": "OpenSpec change",
  "in-progress": "In progress",
  "pr-mr": "PR/MR",
};

/** Each lane's header count and the titles of the cards it shows. */
function laneState(id: LaneId) {
  const region = screen.getByRole("region", { name: TITLES[id] });
  const count = Number(within(region).getByRole("heading", { level: 2 }).nextElementSibling!.textContent!.match(/^\d+/)![0]);
  const titles = within(region)
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);
  return { count, titles };
}

describe("BoardScreen", () => {
  it("shows every lane with its provider cards and counts when no filter is active", () => {
    render(<BoardScreen view={VIEW} />);

    expect(laneState("idea")).toEqual({
      count: 3,
      titles: ["Retry webhook deliveries", "Customer portal dark mode", "Sketch onboarding checklist"],
    });
    expect(laneState("openspec-change").count).toBe(2);
    expect(laneState("in-progress").count).toBe(2);
    expect(laneState("pr-mr")).toEqual({ count: 1, titles: ["Refresh billing emails"] });
  });

  it("filters every lane to one repository, keeps the unbound Idea card, and updates every count", async () => {
    const user = userEvent.setup();
    render(<BoardScreen view={VIEW} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Repository scope" }), "acme/api-gateway");

    expect(laneState("idea")).toEqual({ count: 2, titles: ["Retry webhook deliveries", "Sketch onboarding checklist"] });
    expect(laneState("openspec-change")).toEqual({ count: 1, titles: ["Add idempotency keys"] });
    expect(laneState("in-progress")).toEqual({ count: 1, titles: ["Rate-limit partner API"] });
    expect(laneState("pr-mr")).toEqual({ count: 0, titles: [] });
    expect(screen.getByText("No PR/MR items match these filters")).toBeTruthy();
  });

  it("narrows every lane by the search field in the shell's search slot, and Reset filters restores every card", async () => {
    const user = userEvent.setup();
    const { container } = render(<BoardScreen view={VIEW} />);

    const slot = container.querySelector<HTMLElement>('[data-shell-slot="search"]')!;
    await user.type(within(slot).getByRole("searchbox", { name: BOARD_SEARCH_LABEL }), "  IDEMPOTENCY ");

    expect(laneState("idea")).toEqual({ count: 0, titles: [] });
    expect(laneState("openspec-change")).toEqual({ count: 1, titles: ["Add idempotency keys"] });
    expect(laneState("in-progress").count).toBe(0);
    expect(laneState("pr-mr").count).toBe(0);

    const idea = screen.getByRole("region", { name: "Idea" });
    await user.click(within(idea).getByRole("button", { name: "Reset filters" }));
    expect(laneState("idea").count).toBe(3);
    expect(laneState("pr-mr").count).toBe(1);
    expect((within(slot).getByRole("searchbox") as HTMLInputElement).value).toBe("");
  });

  it("opens with the given initial filters, and Reset filters clears them", async () => {
    const user = userEvent.setup();
    render(<BoardScreen view={VIEW} initialFilters={{ query: "", repositoryId: WEB.githubRepoId, source: "manual", owner: null }} />);

    expect((screen.getByRole("combobox", { name: "Repository scope" }) as HTMLSelectElement).value).toBe(String(WEB.githubRepoId));
    // The unbound manual card passes every repository filter; nothing else is manual.
    expect(laneState("idea")).toEqual({ count: 1, titles: ["Sketch onboarding checklist"] });
    expect(laneState("pr-mr").count).toBe(0);

    const prMr = screen.getByRole("region", { name: "PR/MR" });
    await user.click(within(prMr).getByRole("button", { name: "Reset filters" }));
    expect(laneState("idea").count).toBe(3);
    expect(laneState("pr-mr").count).toBe(1);
    expect((screen.getByRole("combobox", { name: "Repository scope" }) as HTMLSelectElement).value).not.toBe(
      String(WEB.githubRepoId),
    );
  });

  it("names Compose idea without its decorative \"+\"", () => {
    render(<BoardScreen view={VIEW} />);
    const compose = screen.getAllByRole("button", { name: "Compose idea" })[0]!;
    expect(compose.textContent).toBe("+Compose idea");
    expect(compose.querySelector('[aria-hidden="true"]')?.textContent).toBe("+");
  });

  it("treats a whitespace-only query as no filter", async () => {
    const user = userEvent.setup();
    render(<BoardScreen view={VIEW} />);

    await user.type(screen.getByRole("searchbox", { name: BOARD_SEARCH_LABEL }), "   ");
    expect(laneState("idea").count).toBe(3);
    expect(laneState("pr-mr").count).toBe(1);
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
  });

  it("falls back to All repositories when a re-rendered view no longer lists the selected repository", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BoardScreen view={VIEW} />);
    const repository = screen.getByRole("combobox", { name: "Repository scope" }) as HTMLSelectElement;

    await user.selectOptions(repository, "acme/customer-web");
    expect(laneState("idea").count).toBe(2);

    const shorter: BoardViewModel = { ...VIEW, repositories: [API] };
    rerender(<BoardScreen view={shorter} />);

    expect(repository.value).toBe("");
    expect(repository.selectedOptions[0]!.textContent).toBe("All repositories");
    expect([...repository.options].map((option) => option.textContent)).toEqual(["All repositories", "acme/api-gateway"]);
    expect(laneState("idea").count).toBe(3);
    expect(laneState("pr-mr")).toEqual({ count: 1, titles: ["Refresh billing emails"] });
    expect(screen.queryByText(/match these filters|match this repository/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();

    // The fallback is kept: the repository coming back does not restore the old choice.
    rerender(<BoardScreen view={VIEW} />);
    expect(repository.value).toBe("");
    expect(laneState("idea").count).toBe(3);
  });

  it("keeps a repository filter whose repository is still listed after a re-render", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BoardScreen view={VIEW} />);
    const repository = screen.getByRole("combobox", { name: "Repository scope" }) as HTMLSelectElement;

    await user.selectOptions(repository, "acme/api-gateway");
    rerender(<BoardScreen view={{ ...VIEW, repositories: [API] }} />);

    expect(repository.value).toBe(String(API.githubRepoId));
    expect(laneState("idea").count).toBe(2);
  });

  describe("selection (task 5.3)", () => {
    const article = (button: HTMLElement) => button.closest("article")!;
    const pressed = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .filter((button) => button.closest("article") !== null)
        .map((button) => button.textContent);

    it("marks an activated card selected with aria-pressed and the ring, and a second activation clears it", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);

      const button = screen.getByRole("button", { name: "Add idempotency keys" });
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(article(button).classList.contains(cardStyles.selected!)).toBe(false);

      await user.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("true");
      expect(article(button).classList.contains(cardStyles.selected!)).toBe(true);

      await user.click(button);
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(article(button).classList.contains(cardStyles.selected!)).toBe(false);
      expect(screen.queryAllByRole("button", { pressed: true }).filter((b) => b.closest("article"))).toEqual([]);
    });

    it("draws the selected ring as a 2px shape, not a color change alone", () => {
      const css = parseCssRules(readFileSync(join(HERE, "board-card.module.css"), "utf8"));
      const selected = css.find((rule) => rule.selector === ".selected" && rule.atRules.length === 0);
      expect(selected).toBeDefined();
      expect(Object.fromEntries(selected!.declarations)["box-shadow"]).toMatch(/^0 0 0 2px /);
    });

    it("keeps a single selection: activating a second card deselects the first", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);

      await user.click(screen.getByRole("button", { name: "Add idempotency keys" }));
      await user.click(screen.getByRole("button", { name: "Refresh billing emails" }));

      expect(pressed()).toEqual(["Refresh billing emails"]);
      expect(document.querySelectorAll(`article.${cardStyles.selected}`)).toHaveLength(1);
    });

    it("selects and deselects from the keyboard with Enter and Space", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);
      const button = screen.getByRole("button", { name: "Invoice PDF export" });

      button.focus();
      await user.keyboard("{Enter}");
      expect(button.getAttribute("aria-pressed")).toBe("true");
      await user.keyboard("{Enter}");
      expect(button.getAttribute("aria-pressed")).toBe("false");

      await user.keyboard(" ");
      expect(button.getAttribute("aria-pressed")).toBe("true");
      await user.keyboard(" ");
      expect(button.getAttribute("aria-pressed")).toBe("false");
    });

    it("reaches a card with Tab and selects it with Space", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);
      const button = screen.getByRole("button", { name: "Retry webhook deliveries" });

      while (document.activeElement !== button) {
        const before = document.activeElement;
        await user.tab();
        if (document.activeElement === before || document.activeElement === document.body) break;
      }
      expect(document.activeElement).toBe(button);
      await user.keyboard(" ");
      expect(pressed()).toEqual(["Retry webhook deliveries"]);
    });
  });

  describe("selection in the address (task 5.4)", () => {
    const pressedTitles = () =>
      screen
        .queryAllByRole("button", { pressed: true })
        .filter((button) => button.closest("article") !== null)
        .map((button) => button.textContent);

    it("writes ?card=<id> with router.replace on select and removes it on deselect", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);
      const button = screen.getByRole("button", { name: "Add idempotency keys" });

      await user.click(button);
      expect(navigation.replace).toHaveBeenLastCalledWith("/?card=4", { scroll: false });

      await user.click(button);
      expect(navigation.replace).toHaveBeenLastCalledWith("/", { scroll: false });
      expect(navigation.replace).toHaveBeenCalledTimes(2);
    });

    it("keeps the address's other parameters when it writes the card", async () => {
      const user = userEvent.setup();
      navigation.search = "tab=board&card=4";
      render(<BoardScreen view={VIEW} />);

      await user.click(screen.getByRole("button", { name: "Refresh billing emails" }));
      expect(navigation.replace).toHaveBeenLastCalledWith("/?tab=board&card=8", { scroll: false });
    });

    it("initialises the selection from ?card=<id>", () => {
      navigation.search = "card=6";
      render(<BoardScreen view={VIEW} />);

      expect(pressedTitles()).toEqual(["Rate-limit partner API"]);
      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("selects nothing and shows no error text for an unknown card id", () => {
      navigation.search = "card=card-from-another-installation";
      const { container } = render(<BoardScreen view={VIEW} />);

      expect(pressedTitles()).toEqual([]);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(container.textContent).not.toMatch(/error|not found|unknown|card-from-another-installation/i);
      expect(laneState("idea").count).toBe(3);
    });

    it("keeps the selection while a filter hides the card, and shows it selected when the filter is cleared", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);

      await user.click(screen.getByRole("button", { name: "Refresh billing emails" }));
      const repository = screen.getByRole("combobox", { name: "Repository scope" });
      await user.selectOptions(repository, "acme/api-gateway");
      expect(screen.queryByRole("button", { name: "Refresh billing emails" })).toBeNull();
      expect(navigation.replace).toHaveBeenCalledTimes(1);

      await user.selectOptions(repository, "All repositories");
      expect(pressedTitles()).toEqual(["Refresh billing emails"]);
    });

    it("clears the selection when its card leaves the view", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<BoardScreen view={VIEW} />);
      await user.click(screen.getByRole("button", { name: "Refresh billing emails" }));

      rerender(<BoardScreen view={{ ...VIEW, lanes: [VIEW.lanes[0], VIEW.lanes[1], VIEW.lanes[2], lane("pr-mr", [])] }} />);
      expect(pressedTitles()).toEqual([]);

      rerender(<BoardScreen view={VIEW} />);
      expect(pressedTitles()).toEqual([]);
    });
  });

  describe("small-screen lane selector (task 5.5)", () => {
    const laneRow = () => document.querySelector<HTMLElement>("[data-active-lane]")!;

    it("starts on the Idea lane and changes data-active-lane when a tab is activated", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);

      expect(laneRow().getAttribute("data-active-lane")).toBe("idea");
      await user.click(screen.getByRole("tab", { name: /^PR\/MR/ }));
      expect(laneRow().getAttribute("data-active-lane")).toBe("pr-mr");
      expect(screen.getByRole("tab", { selected: true }).getAttribute("data-lane-id")).toBe("pr-mr");

      await user.keyboard("{ArrowLeft}");
      expect(laneRow().getAttribute("data-active-lane")).toBe("in-progress");

      // All four lanes stay in the DOM; only CSS decides which one shows.
      expect(laneRow().querySelectorAll(":scope > section[data-lane-id]")).toHaveLength(4);
    });

    it("shows every lane's filtered count, keeping an emptied active lane listed", async () => {
      const user = userEvent.setup();
      render(<BoardScreen view={VIEW} />);

      await user.click(screen.getByRole("tab", { name: /^PR\/MR/ }));
      await user.selectOptions(screen.getByRole("combobox", { name: "Repository scope" }), "acme/api-gateway");

      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Idea2 cards",
        "OpenSpec change1 card",
        "In progress1 card",
        "PR/MR0 cards",
      ]);
      expect(laneRow().getAttribute("data-active-lane")).toBe("pr-mr");
      const prMr = screen.getByRole("region", { name: "PR/MR" });
      expect(within(prMr).getByText("No PR/MR items match these filters")).toBeTruthy();
      expect(within(prMr).getByRole("button", { name: "Reset filters" })).toBeTruthy();
    });

    it("declares the under-760px single-lane rule and the 760px-and-above selector hide rule", () => {
      const css = parseCssRules(readFileSync(join(HERE, "board.module.css"), "utf8"));
      const small = css.filter((rule) => rule.atRules.join(" ") === "@media (max-width: 759.98px)");
      const wide = css.filter((rule) => rule.atRules.join(" ") === "@media (min-width: 760px)");

      const hideLanes = small.find((rule) => rule.selector === ".lanes > [data-lane-id]");
      expect(Object.fromEntries(hideLanes!.declarations)["display"]).toBe("none");
      const showActive = small.find((rule) => rule.selector.includes('.lanes[data-active-lane="idea"] > [data-lane-id="idea"]'));
      expect(Object.fromEntries(showActive!.declarations)["display"]).toBe("flex");
      for (const laneId of ["idea", "openspec-change", "in-progress", "pr-mr"]) {
        expect(showActive!.selector).toContain(`.lanes[data-active-lane="${laneId}"] > [data-lane-id="${laneId}"]`);
      }

      const hideSelector = wide.find((rule) => rule.selector === ".laneSelector");
      expect(Object.fromEntries(hideSelector!.declarations)["display"]).toBe("none");
    });

    it("puts the tablist inside the element the wide-screen rule hides", () => {
      render(<BoardScreen view={VIEW} />);
      expect(screen.getByRole("tablist").parentElement!.classList.contains(boardStyles.laneSelector!)).toBe(true);
    });

    it("renders no lane selector on the empty board", () => {
      const empty: BoardViewModel = {
        ...VIEW,
        lanes: [lane("idea", []), lane("openspec-change", []), lane("in-progress", []), lane("pr-mr", [])],
      };
      render(<BoardScreen view={empty} />);
      expect(screen.queryByRole("tablist")).toBeNull();
    });
  });

  describe("pending and onManualRead (task 5.7)", () => {
    const LISTENING: BoardViewModel = {
      ...VIEW,
      lanes: [
        {
          ...VIEW.lanes[0],
          listener: { status: "healthy", intervalMinutes: 5, lastHeardAt: "2026-09-24T11:57:00.000Z" },
          manualRead: {
            kind: "load-ideas",
            availability: { status: "available" },
            options: [
              { id: "github", label: "GitHub Issues", badge: "github", viaMcp: true },
              { id: "manual", label: "Manual inbox", badge: "manual", viaMcp: false },
            ],
          },
        },
        { ...VIEW.lanes[1], listener: { status: "delayed", intervalMinutes: 10, lastSuccessAt: null, retrying: true } },
        VIEW.lanes[2],
        {
          ...VIEW.lanes[3],
          listener: { status: "never-heard", intervalMinutes: 15 },
          manualRead: {
            kind: "fetch-pull-requests",
            availability: { status: "available" },
            options: [{ id: "github-prs", label: "GitHub pull requests", badge: "github", viaMcp: true }],
          },
        },
      ],
    };

    const LISTENER_TEXT: Readonly<Record<LaneId, string>> = {
      idea: "Listening every 5 min·Last heard 3 min ago",
      "openspec-change": "Listening delayed · retrying·No successful listen yet",
      "in-progress": "Listener not configured",
      "pr-mr": "Listening every 15 min·Not heard yet",
    };
    const LOADING_LABELS: Readonly<Record<LaneId, string>> = {
      idea: "Reading GitHub Issues, GitLab, Jira via MCP…",
      "openspec-change": "Reconciling OpenSpec artifacts…",
      "in-progress": "Reconciling commits and session evidence…",
      "pr-mr": "Fetching PRs and MRs via MCP…",
    };
    const listenerText = (region: HTMLElement) => region.querySelector("[data-listener-status]")!.textContent;
    const LANE_ORDER: LaneId[] = ["idea", "openspec-change", "in-progress", "pr-mr"];

    it("shows placeholders in every lane while pending, and the headers keep their listener text and counts", () => {
      const { rerender } = render(<BoardScreen view={LISTENING} />);
      for (const id of LANE_ORDER) {
        expect(listenerText(screen.getByRole("region", { name: TITLES[id] }))).toBe(LISTENER_TEXT[id]);
      }

      rerender(<BoardScreen view={LISTENING} pending />);

      for (const id of LANE_ORDER) {
        const region = screen.getByRole("region", { name: TITLES[id] });
        expect(region.getAttribute("aria-busy")).toBe("true");
        expect(listenerText(region)).toBe(LISTENER_TEXT[id]);
        expect(within(region).queryByText("Checking listener…")).toBeNull();
        expect(within(region).queryAllByRole("heading", { level: 3 })).toEqual([]);
        const placeholder = within(region).getByRole("status");
        expect(placeholder.getAttribute("aria-busy")).toBe("true");
        expect(placeholder.getAttribute("aria-label")).toBe(LOADING_LABELS[id]);
      }
      expect(laneState("idea").count).toBe(3);
      expect(laneState("pr-mr").count).toBe(1);

      rerender(<BoardScreen view={LISTENING} />);
      expect(laneState("idea").titles).toHaveLength(3);
      expect(screen.queryAllByRole("status")).toEqual([]);
    });

    it("shows pending lanes rather than the empty board while a read is in progress", () => {
      const empty: BoardViewModel = {
        ...LISTENING,
        lanes: [
          { ...LISTENING.lanes[0], cards: [] },
          { ...LISTENING.lanes[1], cards: [] },
          { ...LISTENING.lanes[2], cards: [] },
          { ...LISTENING.lanes[3], cards: [] },
        ],
      };
      render(<BoardScreen view={empty} pending />);

      expect(screen.getByRole("region", { name: "Idea" }).getAttribute("aria-busy")).toBe("true");
      expect(screen.queryByRole("heading", { name: "Idea intake is not enabled for this installation yet" })).toBeNull();
    });

    it("passes onManualRead to the toolbar and lane-header manual-read menus", async () => {
      const user = userEvent.setup();
      const onManualRead = vi.fn();
      render(<BoardScreen view={LISTENING} onManualRead={onManualRead} />);

      const [toolbarLoad, headerLoad] = screen.getAllByRole("button", { name: /Load ideas/ });
      await user.click(toolbarLoad!);
      await user.click(screen.getByRole("menuitem", { name: /Manual inbox/ }));
      expect(onManualRead).toHaveBeenLastCalledWith("load-ideas", "manual");

      await user.click(headerLoad!);
      await user.click(screen.getByRole("menuitem", { name: /GitHub Issues/ }));
      expect(onManualRead).toHaveBeenLastCalledWith("load-ideas", "github");

      const prMr = screen.getByRole("region", { name: "PR/MR" });
      await user.click(within(prMr).getByRole("button", { name: /Fetch PRs\/MRs/ }));
      await user.click(screen.getByRole("menuitem", { name: /GitHub pull requests/ }));
      expect(onManualRead).toHaveBeenLastCalledWith("fetch-pull-requests", "github-prs");
      expect(onManualRead).toHaveBeenCalledTimes(3);
    });
  });

  it("keeps one toolbar popover open at a time", async () => {
    const user = userEvent.setup();
    const view: BoardViewModel = {
      ...VIEW,
      lanes: [
        {
          ...VIEW.lanes[0],
          manualRead: {
            kind: "load-ideas",
            availability: { status: "available" },
            options: [{ id: "github", label: "GitHub Issues", badge: "github", viaMcp: true }],
          },
        },
        VIEW.lanes[1],
        VIEW.lanes[2],
        VIEW.lanes[3],
      ],
    };
    render(<BoardScreen view={view} />);

    const toolbarLoad = screen.getAllByRole("button", { name: /Load ideas/ })[0]!;
    const legend = screen.getByRole("button", { name: "How column placement works" });
    await user.click(legend);
    expect(legend.getAttribute("aria-expanded")).toBe("true");
    await user.click(toolbarLoad);
    expect(toolbarLoad.getAttribute("aria-expanded")).toBe("true");
    expect(legend.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the empty board, not four empty lanes, when the board has no cards", () => {
    const empty: BoardViewModel = {
      ...VIEW,
      lanes: [lane("idea", []), lane("openspec-change", []), lane("in-progress", []), lane("pr-mr", [])],
    };
    render(<BoardScreen view={empty} />);

    expect(screen.getByRole("heading", { name: "Idea intake is not enabled for this installation yet" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "PR/MR" })).toBeNull();
  });
});
