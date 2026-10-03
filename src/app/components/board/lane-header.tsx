// Task 3.4 (specs/workflow-board/spec.md "Show a truthful listener state on
// every lane"; design.md Decision 4, "Lane identity and copy" and "Listener
// text"): a lane's header — title, visible card count, sublabel, the listener
// lines, and the place a manual-read control sits.
//
// Every string comes from a canonical module: title and sublabel from
// `LANES`, listener wording from `formatListenerState` measured against the
// board's `generatedAt`. The interval line renders only when the formatter
// returns one, so a lane with no configured listener can never read
// "Listening every …". A degraded listener is told apart by its words; the
// `degraded` class only reinforces them with an icon color.
//
// Task 3.5 (spec "Offer manual reads only on the Idea and PR/MR lanes";
// design.md Decision 2): the header renders a manual-read control only on
// `idea` (`load-ideas`) and `pr-mr` (`fetch-pull-requests`). A `manualRead`
// on any other lane, or of the other lane's kind, is ignored — the one place
// the UI is deliberately stricter than its input. By default the control is a
// compact `ManualReadMenu`, which shows an unavailable read as a disabled
// button with the reason as visible text.
import type { ReactNode } from "react";
import type { LaneId, LaneViewModel, ManualRead, ManualReadKind } from "../../../lib/board/board-view-model";
import { LANES } from "../../../lib/board/lanes";
import { formatListenerState } from "../../../lib/board/listener-text";
import { ManualReadMenu } from "./manual-read-menu";
import styles from "./lane-header.module.css";

/** The only lanes that may carry a manual read, and the read each one offers. */
export const MANUAL_READ_LANES: Readonly<Partial<Record<LaneId, ManualReadKind>>> = {
  idea: "load-ideas",
  "pr-mr": "fetch-pull-requests",
};

/** The lane's manual read if this lane may show it, otherwise `null`. */
export function permittedManualRead(lane: LaneViewModel): ManualRead | null {
  const kind = MANUAL_READ_LANES[lane.id];
  return kind !== undefined && lane.manualRead !== null && lane.manualRead.kind === kind ? lane.manualRead : null;
}

export interface LaneHeaderProps {
  lane: LaneViewModel;
  /** Cards the lane shows after the active filters. */
  count: number;
  /** `BoardViewModel.generatedAt`; every listener duration is measured against it. */
  generatedAt: string;
  /** Passed to the default compact `ManualReadMenu`; production passes none. */
  onManualRead?: (kind: ManualReadKind, optionId: string) => void;
  /** Overrides the default control; called only for a permitted `manualRead`. */
  renderManualRead?: (manualRead: ManualRead) => ReactNode;
  /**
   * Task 3.8: the board is still loading. The count reads "…" and the
   * listener line "Checking listener…"; `count` and `lane.listener` are not
   * shown, and no manual-read control renders.
   */
  loading?: boolean;
}

/** Listener line shown while the board loads (design.md Decision 8). */
export const CHECKING_LISTENER_TEXT = "Checking listener…";

export function LaneHeader({ lane, count, generatedAt, onManualRead, renderManualRead, loading = false }: LaneHeaderProps) {
  const copy = LANES[lane.id];
  const listener = loading
    ? { intervalLine: null, heardLine: CHECKING_LISTENER_TEXT, degraded: false }
    : formatListenerState(lane.listener, generatedAt);
  const manualRead = loading ? null : permittedManualRead(lane);
  const control =
    manualRead === null ? null : renderManualRead ? (
      renderManualRead(manualRead)
    ) : (
      <ManualReadMenu manualRead={manualRead} size="compact" onManualRead={onManualRead} />
    );

  return (
    <header className={styles.header} data-lane-id={lane.id}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>{copy.title}</h2>
        {loading ? (
          <span className={styles.count}>
            …<span className={styles.visuallyHidden}> cards loading</span>
          </span>
        ) : (
          <span className={styles.count}>
            {count}
            <span className={styles.visuallyHidden}>{count === 1 ? " card" : " cards"}</span>
          </span>
        )}
        {control ? <div className={styles.control}>{control}</div> : null}
      </div>
      <p className={styles.sublabel}>{copy.sublabel}</p>
      <p
        className={[styles.listener, listener.degraded ? styles.degraded : null].filter(Boolean).join(" ")}
        data-listener-status={loading ? "checking" : lane.listener.status}
      >
        <svg className={styles.icon} width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 3.4V6l1.8 1.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {listener.intervalLine !== null ? (
          <>
            <span>{listener.intervalLine}</span>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <span>{listener.heardLine}</span>
      </p>
    </header>
  );
}
