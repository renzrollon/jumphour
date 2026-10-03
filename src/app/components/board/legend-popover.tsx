"use client";

// Task 4.3: the lifecycle legend. Lane rules come from LANES in LANE_IDS order;
// Escape, outside press and focus return come from the shared Popover. The
// trigger is the prototype's round "i" button: the glyph is decorative and the
// button's accessible name is LEGEND_TRIGGER_LABEL.
import { LANES, LANE_IDS } from "../../../lib/board/lanes";
import { Popover } from "../ui/popover";
import type { TransientStateProps } from "../ui/transient";
import styles from "./legend-popover.module.css";

export const LEGEND_TRIGGER_LABEL = "How column placement works";
export const LEGEND_SUMMARY = "Column placement is calculated from source, OpenSpec, session, and PR/MR evidence.";
export const LEGEND_NO_MANUAL = "Cards cannot be dragged or set manually.";
export const LEGEND_NO_WRITES = "Jumphour never writes to a source.";

export function LegendPopover(props: TransientStateProps) {
  return (
    <Popover
      {...props}
      label={LEGEND_TRIGGER_LABEL}
      align="end"
      renderTrigger={(trigger) => (
        <button {...trigger} className={styles.trigger} aria-label={LEGEND_TRIGGER_LABEL} title={LEGEND_TRIGGER_LABEL}>
          <span aria-hidden="true">i</span>
        </button>
      )}
    >
      <div className={styles.body}>
        <p className={styles.summary}>{LEGEND_SUMMARY}</p>
        <ol className={styles.rules}>
          {LANE_IDS.map((id) => (
            <li key={id}>
              <strong>{LANES[id].title}</strong> — {LANES[id].legendRule}
            </li>
          ))}
        </ol>
        <p className={styles.note}>
          {LEGEND_NO_MANUAL} {LEGEND_NO_WRITES}
        </p>
      </div>
    </Popover>
  );
}
