"use client";

// Task 5.1 (specs/workflow-board/spec.md "Filter the board by repository,
// source, and owner", "Search cards across all lanes"; design.md Decision 3):
// the signed-in board. The server page builds the `BoardViewModel`; this
// component owns the only interaction state the board has:
//   - the filters (repository, source, owner) and the search query, together
//     as one `BoardFilters`;
//   - the selected card id;
//   - the active small-screen lane;
//   - which toolbar popover is open (the legend or the Load ideas menu).
// Everything it shows is `view` passed through pure functions: each lane's
// visible cards are `cardMatchesFilters` over that lane's provider cards, and
// each lane count is the number of visible cards. Nothing here derives a
// card's lane, a listener state, or an availability.
//
// The search field goes into the shell's search slot through `AppShell`'s
// `search` prop; the rest of the shell comes from `shell`, as the page reads it.
//
// Task 5.2 (spec "Filter the board by repository, source, and owner", failure
// "selected repository is no longer in the installation"; design.md Decision
// 4): when a re-rendered `view.repositories` no longer holds the selected
// `githubRepoId`, the repository filter falls back to "All repositories". The
// stored filter is reset during render (not only masked), so the choice does
// not come back if the repository later reappears.
//
// Task 5.3 (spec "Select a card by pointer or keyboard"; design.md Decision
// 5): one card is selected at a time. Activating a card selects it (replacing
// any other selection); activating the selected card again clears it. Each
// card's title is a native `<button aria-pressed>`, so Enter and Space
// activate it with no key handler, and the selected card draws a 2px ring
// (board-card.module.css `.selected`) as well as `aria-pressed="true"`.
//
// Task 5.5 (spec "Provide single-lane navigation on small screens"; design.md
// Decision 7): the lane selector sets the active lane, which the lane row
// carries as `data-active-lane`. board.module.css shows the selector and only
// the active lane under 760px, and hides the selector at 760px and above; no
// code here reads the viewport.
//
// Task 5.7 (design.md Decision 8, "Manual-read pending"): `onManualRead` is
// handed to both Load ideas menus (toolbar and Idea lane header) and to the
// PR/MR header's Fetch PRs/MRs menu. `pending` replaces every lane's cards
// with placeholders labelled by the lane's `loadingLabel`, announced busy,
// while the real lane headers stay — title, count, and the last known
// listener text. Production passes neither prop (every manual read is
// unavailable); the preview page flips `pending` around a simulated read.
//
// Task 5.4 (spec "Select a card by pointer or keyboard"; design.md Decision
// 6): the selection lives in the address as `?card=<id>`. The selected id is
// initialised from the `card` search parameter and every change is written
// back with `router.replace` (no history entry per click), keeping any other
// parameters. An id that is not a card in `view` selects nothing, silently —
// no error text: `view` is already scoped to the installation, so "not mine"
// and "does not exist" look the same. The selection is kept while its card is
// in `view`, even when a filter hides it, and clears once the card leaves
// `view`.
import { useCallback, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  BoardViewModel,
  CardViewModel,
  LaneId,
  LaneViewModel,
  ManualReadKind,
  RepositoryRef,
} from "../../../lib/board/board-view-model";
import { NO_FILTERS, cardMatchesFilters, type BoardFilters } from "../../../lib/board/filter-cards";
import { LANES } from "../../../lib/board/lanes";
import { AppShell, type AppShellProps } from "../shell/app-shell";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { BoardSearch } from "./board-search";
import { BoardToolbar } from "./board-toolbar";
import { EmptyBoard } from "./empty-board";
import { Lane } from "./lane";
import { LaneHeader, permittedManualRead } from "./lane-header";
import { LaneSelector } from "./lane-selector";
import { LegendPopover } from "./legend-popover";
import { ManualReadMenu } from "./manual-read-menu";
import styles from "./board.module.css";
import laneStyles from "./lane.module.css";

/** The toolbar surface that is open, if any; opening one closes the other. */
export type BoardPopover = "legend" | "load-ideas";

/**
 * `filters` with the repository filter cleared when its `githubRepoId` is not
 * one of `repositories`; otherwise `filters` itself (same reference).
 */
export function clampRepositoryFilter(filters: BoardFilters, repositories: readonly RepositoryRef[]): BoardFilters {
  if (filters.repositoryId === null) return filters;
  const id = filters.repositoryId;
  return repositories.some((repository) => repository.githubRepoId === id) ? filters : { ...filters, repositoryId: null };
}

export interface BoardScreenProps {
  view: BoardViewModel;
  /** The shell's workspace, account, and appearance, as the page reads them. */
  shell?: Omit<AppShellProps, "children" | "search">;
  /** A manual read is in progress: lanes show placeholders under their real headers. Production passes none. */
  pending?: boolean;
  /** Called when a manual-read menu option is chosen. Production passes none. */
  onManualRead?: (kind: ManualReadKind, optionId: string) => void;
  /**
   * The filters the board opens with; read once, on mount. Production passes
   * none (the board opens unfiltered); the preview's filtered-empty scenario
   * opens pre-filtered, as the prototype does.
   */
  initialFilters?: BoardFilters;
}

/** The search parameter that names the selected card. */
export const CARD_PARAM = "card";

/** `pathname` with `search` carrying `card=<cardId>`, or no `card` for `null`; other parameters are kept. */
export function addressWithCard(pathname: string, search: string, cardId: string | null): string {
  const params = new URLSearchParams(search);
  if (cardId === null) params.delete(CARD_PARAM);
  else params.set(CARD_PARAM, cardId);
  const query = params.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}

/** Placeholder cards per lane while a manual read is pending. */
const PENDING_ROWS = 3;

interface PendingLaneProps {
  lane: LaneViewModel;
  count: number;
  generatedAt: string;
  onManualRead?: (kind: ManualReadKind, optionId: string) => void;
}

/** A lane while a manual read is pending: its real header over labelled placeholders. */
function PendingLane({ lane, count, generatedAt, onManualRead }: PendingLaneProps) {
  const copy = LANES[lane.id];
  return (
    <section className={laneStyles.lane} aria-label={copy.title} aria-busy="true" data-lane-id={lane.id} data-lane-pending="">
      <LaneHeader lane={lane} count={count} generatedAt={generatedAt} onManualRead={onManualRead} />
      <div className={laneStyles.body}>
        <Skeleton label={copy.loadingLabel} rows={PENDING_ROWS} labelVisible />
      </div>
    </section>
  );
}

export function BoardScreen({ view, shell, pending = false, onManualRead, initialFilters }: BoardScreenProps) {
  const [storedFilters, setFilters] = useState<BoardFilters>(() => initialFilters ?? NO_FILTERS);
  const filters = clampRepositoryFilter(storedFilters, view.repositories);
  if (filters !== storedFilters) setFilters(filters);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [storedCardId, setSelectedCardId] = useState<string | null>(() => searchParams.get(CARD_PARAM));
  const [activeLane, setActiveLane] = useState<LaneId>("idea");
  const [openPopover, setOpenPopover] = useState<BoardPopover | null>(null);
  const composeReasonId = useId();

  const allCards = useMemo<CardViewModel[]>(() => view.lanes.flatMap((lane) => lane.cards), [view.lanes]);
  const selectedCardId = storedCardId !== null && allCards.some((card) => card.id === storedCardId) ? storedCardId : null;
  if (selectedCardId !== storedCardId) setSelectedCardId(selectedCardId);
  const visibleCards = useMemo(
    () => view.lanes.map((lane) => lane.cards.filter((card) => cardMatchesFilters(card, filters))),
    [view.lanes, filters],
  );
  const counts = useMemo(
    () => Object.fromEntries(view.lanes.map((lane, index) => [lane.id, visibleCards[index]!.length])) as Record<LaneId, number>,
    [view.lanes, visibleCards],
  );

  const resetFilters = useCallback(() => setFilters(NO_FILTERS), []);
  const toggleCard = useCallback(
    (cardId: string) => {
      const next = selectedCardId === cardId ? null : cardId;
      setSelectedCardId(next);
      router.replace(addressWithCard(pathname, searchParams.toString(), next), { scroll: false });
    },
    [selectedCardId, router, pathname, searchParams],
  );
  const popoverState = (popover: BoardPopover) => ({
    open: openPopover === popover,
    onOpenChange: (open: boolean) => setOpenPopover((current) => (open ? popover : current === popover ? null : current)),
  });

  const ideaLane = view.lanes[0];
  const loadIdeas = permittedManualRead(ideaLane);
  const composeUnavailable = view.compose.status === "unavailable";

  return (
    <AppShell {...shell} search={<BoardSearch value={filters.query} onChange={(query) => setFilters((current) => ({ ...current, query }))} />}>
      <div className={styles.screen}>
        <BoardToolbar repositories={view.repositories} cards={allCards} filters={filters} onFiltersChange={setFilters}>
          <LegendPopover {...popoverState("legend")} />
          {loadIdeas !== null ? <ManualReadMenu manualRead={loadIdeas} onManualRead={onManualRead} {...popoverState("load-ideas")} /> : null}
          <div className={styles.compose}>
            <Button
              variant="primary"
              disabled={composeUnavailable}
              aria-describedby={composeUnavailable ? composeReasonId : undefined}
            >
              <span aria-hidden="true" className={styles.composeGlyph}>
                +
              </span>
              Compose idea
            </Button>
            {view.compose.status === "unavailable" ? (
              <span id={composeReasonId} className={styles.reason}>
                {view.compose.reason}
              </span>
            ) : null}
          </div>
        </BoardToolbar>

        {allCards.length === 0 && !pending ? (
          <EmptyBoard loadIdeas={loadIdeas?.availability ?? view.compose} compose={view.compose} />
        ) : (
          <>
            <div className={styles.laneSelector}>
              <LaneSelector activeLane={activeLane} counts={counts} onSelectLane={setActiveLane} />
            </div>
            <div className={styles.lanes} data-active-lane={activeLane}>
              {view.lanes.map((lane, index) =>
                pending ? (
                  <PendingLane
                    key={lane.id}
                    lane={lane}
                    count={visibleCards[index]!.length}
                    generatedAt={view.generatedAt}
                    onManualRead={onManualRead}
                  />
                ) : (
                  <Lane
                    key={lane.id}
                    lane={lane}
                    cards={visibleCards[index]!}
                    filters={filters}
                    generatedAt={view.generatedAt}
                    compose={view.compose}
                    selectedCardId={selectedCardId}
                    onSelectCard={toggleCard}
                    onResetFilters={resetFilters}
                    onManualRead={onManualRead}
                  />
                ),
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
