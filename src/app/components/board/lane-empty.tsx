// Task 3.6 (specs/workflow-board/spec.md "Distinguish first-use, not-enabled,
// filtered-empty, and loading states", edge cases "lane emptied by filters"
// and "nothing derived into a lane"): what a lane shows when it has no cards
// to show.
//
// Two variants, chosen only by `filtersActive` (design.md Decision 4 — a
// whitespace-only query is not active):
//   - filtered-empty: the Idea lane names the source and whether a repository
//     is chosen ("No Jira ideas match this repository"); every other lane
//     names itself ("No in progress items match these filters"). It offers
//     "Reset filters", and the Idea lane also offers "Compose idea".
//   - nothing-derived: "Nothing derived into <lane title> yet", with no action.
// Lane titles come from `LANES` and source names from `sourcePresentation`.
import { useId } from "react";
import type { Availability, LaneId } from "../../../lib/board/board-view-model";
import { filtersActive, type BoardFilters } from "../../../lib/board/filter-cards";
import { LANES } from "../../../lib/board/lanes";
import { sourcePresentation } from "../../../lib/board/source-presentation";
import { Button } from "../ui/button";
import styles from "./lane-empty.module.css";

/**
 * A lane title as a noun inside a sentence: plain capitalised words are
 * lowercased, names and acronyms ("OpenSpec", "PR/MR") are kept.
 */
function laneNoun(laneId: LaneId): string {
  return LANES[laneId].title
    .split(" ")
    .map((word) => (/^[A-Z][a-z]*$/.test(word) ? word.toLowerCase() : word))
    .join(" ");
}

/**
 * A source's name in prose: its presentation label without the " · MCP"
 * transport mark ("Jira · MCP" → "Jira").
 */
function sourceNoun(filters: BoardFilters): string | null {
  return filters.source === null ? null : sourcePresentation(filters.source).label.split(" · ")[0]!;
}

/** The empty lane's message for these filters. */
export function laneEmptyText(laneId: LaneId, filters: BoardFilters): string {
  if (!filtersActive(filters)) return `Nothing derived into ${LANES[laneId].title} yet`;
  if (laneId === "idea") {
    const source = sourceNoun(filters);
    const scope = filters.repositoryId !== null ? "this repository" : "these filters";
    return `No ${source !== null ? `${source} ` : ""}ideas match ${scope}`;
  }
  return `No ${laneNoun(laneId)} items match these filters`;
}

export interface LaneEmptyProps {
  laneId: LaneId;
  filters: BoardFilters;
  /** `BoardViewModel.compose`; only the Idea lane's filtered-empty state offers Compose idea. */
  compose: Availability;
  onResetFilters?: () => void;
  onCompose?: () => void;
}

export function LaneEmpty({ laneId, filters, compose, onResetFilters, onCompose }: LaneEmptyProps) {
  const reasonId = useId();
  const filtered = filtersActive(filters);
  const offerCompose = filtered && laneId === "idea";
  const composeUnavailable = compose.status === "unavailable";

  return (
    <div className={styles.empty} data-lane-empty={filtered ? "filtered" : "nothing-derived"}>
      <p className={styles.message}>{laneEmptyText(laneId, filters)}</p>
      {filtered ? (
        <div className={styles.actions}>
          <Button variant="secondary" className={styles.action} onClick={onResetFilters}>
            Reset filters
          </Button>
          {offerCompose ? (
            <Button
              variant="ghost"
              className={styles.action}
              disabled={composeUnavailable}
              aria-describedby={composeUnavailable ? reasonId : undefined}
              onClick={composeUnavailable ? undefined : onCompose}
            >
              Compose idea
            </Button>
          ) : null}
        </div>
      ) : null}
      {offerCompose && compose.status === "unavailable" ? (
        <p id={reasonId} className={styles.reason}>
          {compose.reason}
        </p>
      ) : null}
    </div>
  );
}
