// workflow-board-ui task 6.5 (specs/workflow-board/spec.md "Distinguish
// first-use, not-enabled, filtered-empty, and loading states", edge case
// "board is loading"; design.md Decision 8): the route-level loading view is
// the board skeleton — the four real lane headers (title and sublabel from
// LANES, count "…", "Checking listener…") over placeholders labelled with
// each lane's loadingLabel, announced busy. The placeholders stop animating
// under `prefers-reduced-motion` through the global rule.
import { BoardSkeleton } from "./components/board/board-skeleton";

export default function Loading() {
  return <BoardSkeleton />;
}
