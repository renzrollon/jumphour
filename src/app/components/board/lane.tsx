// Task 3.6 (specs/workflow-board/spec.md "Present a fixed four-lane projection
// board" and "Distinguish first-use, not-enabled, filtered-empty, and loading
// states"): one board lane — its header, then its visible cards or, when none
// are visible, its empty state.
//
// The lane shows what it is given. `cards` are the lane's cards after the
// board's filters (BoardScreen derives them through `filter-cards.ts`); the
// count in the header is their number. The lane never decides a card's lane,
// a listener state, or an availability.
import type { Availability, CardViewModel, LaneViewModel, ManualReadKind } from "../../../lib/board/board-view-model";
import type { BoardFilters } from "../../../lib/board/filter-cards";
import { LANES } from "../../../lib/board/lanes";
import { BoardCard } from "./board-card";
import { LaneEmpty } from "./lane-empty";
import { LaneHeader } from "./lane-header";
import styles from "./lane.module.css";

export interface LaneProps {
  lane: LaneViewModel;
  /** The lane's cards that pass the active filters, in provider order. */
  cards: readonly CardViewModel[];
  filters: BoardFilters;
  /** `BoardViewModel.generatedAt`. */
  generatedAt: string;
  /** `BoardViewModel.compose`. */
  compose: Availability;
  selectedCardId: string | null;
  onSelectCard?: (cardId: string) => void;
  onResetFilters?: () => void;
  onCompose?: () => void;
  onManualRead?: (kind: ManualReadKind, optionId: string) => void;
}

export function Lane({
  lane,
  cards,
  filters,
  generatedAt,
  compose,
  selectedCardId,
  onSelectCard,
  onResetFilters,
  onCompose,
  onManualRead,
}: LaneProps) {
  return (
    <section className={styles.lane} aria-label={LANES[lane.id].title} data-lane-id={lane.id}>
      <LaneHeader lane={lane} count={cards.length} generatedAt={generatedAt} onManualRead={onManualRead} />
      <div className={styles.body}>
        {cards.length > 0 ? (
          cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              generatedAt={generatedAt}
              selected={card.id === selectedCardId}
              onSelect={onSelectCard}
            />
          ))
        ) : (
          <LaneEmpty
            laneId={lane.id}
            filters={filters}
            compose={compose}
            onResetFilters={onResetFilters}
            onCompose={onCompose}
          />
        )}
      </div>
    </section>
  );
}
