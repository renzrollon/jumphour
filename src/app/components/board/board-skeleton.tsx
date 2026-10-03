// Task 3.8 (spec "Distinguish first-use, not-enabled, filtered-empty, and
// loading states", edge case "board is loading"; design.md Decision 8): the
// board while its data is being read. Lane headers persist — the four real
// headers with their titles and sublabels, a count of "…" and the listener
// line "Checking listener…" — over placeholder cards labelled with each
// lane's `loadingLabel`. Every lane is announced busy; the shimmer stops under
// reduced motion through the Skeleton primitive and the global rule.
import type { LaneViewModel } from "../../../lib/board/board-view-model";
import { LANE_IDS, LANES } from "../../../lib/board/lanes";
import { Skeleton } from "../ui/skeleton";
import { LaneHeader } from "./lane-header";
import styles from "./board-skeleton.module.css";

/** Placeholder cards per lane. */
const PLACEHOLDER_ROWS = 3;

/** Headers need a lane shape; nothing about it is shown while loading. */
const LOADING_GENERATED_AT = new Date(0).toISOString();

function loadingLane(id: LaneViewModel["id"]): LaneViewModel {
  return { id, listener: { status: "not-configured" }, manualRead: null, cards: [] };
}

export function BoardSkeleton() {
  return (
    <div className={styles.board} aria-busy="true" data-board-loading="">
      {LANE_IDS.map((id) => (
        <section key={id} className={styles.lane} aria-busy="true" aria-label={LANES[id].title} data-lane-id={id}>
          <LaneHeader lane={loadingLane(id)} count={0} generatedAt={LOADING_GENERATED_AT} loading />
          <Skeleton label={LANES[id].loadingLabel} rows={PLACEHOLDER_ROWS} labelVisible className={styles.placeholders} />
        </section>
      ))}
    </div>
  );
}
