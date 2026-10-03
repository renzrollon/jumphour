"use client";

// Task 5.5 (spec "Provide single-lane navigation on small screens"; design.md
// Decision 7): the small-screen lane selector. A `role="tablist"` of the four
// lanes in `LANE_IDS` order, each tab showing the lane title from `LANES` and
// the lane's visible-card count. The current lane is `aria-selected="true"`
// and the only tab in the Tab order (roving tabindex); Arrow Left/Right, Home
// and End move between tabs and activate the one they land on.
//
// The selector reads no viewport width. BoardScreen feeds the chosen lane into
// `data-active-lane` on the lane row, and board.module.css decides — by media
// query alone — whether the selector is shown and which lanes are displayed.
import { useRef, type KeyboardEvent } from "react";
import type { LaneId } from "../../../lib/board/board-view-model";
import { LANE_IDS, LANES } from "../../../lib/board/lanes";
import styles from "./lane-selector.module.css";

export const LANE_SELECTOR_LABEL = "Lanes";

export interface LaneSelectorProps {
  activeLane: LaneId;
  /** Visible (filtered) card count per lane. */
  counts: Readonly<Record<LaneId, number>>;
  onSelectLane: (laneId: LaneId) => void;
}

export function LaneSelector({ activeLane, counts, onSelectLane }: LaneSelectorProps) {
  const tabs = useRef<Partial<Record<LaneId, HTMLButtonElement | null>>>({});

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = LANE_IDS.indexOf(activeLane);
    const last = LANE_IDS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % LANE_IDS.length
        : event.key === "ArrowLeft"
          ? (index + last) % LANE_IDS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const laneId = LANE_IDS[next]!;
    onSelectLane(laneId);
    tabs.current[laneId]?.focus();
  };

  return (
    <div role="tablist" aria-label={LANE_SELECTOR_LABEL} className={styles.tablist} onKeyDown={move}>
      {LANE_IDS.map((laneId) => {
        const selected = laneId === activeLane;
        const count = counts[laneId];
        return (
          <button
            key={laneId}
            ref={(element) => {
              tabs.current[laneId] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-lane-id={laneId}
            onClick={() => onSelectLane(laneId)}
          >
            <span className={styles.title}>{LANES[laneId].title}</span>
            <span className={styles.count}>
              {count}
              <span className={styles.visuallyHidden}>{count === 1 ? " card" : " cards"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
