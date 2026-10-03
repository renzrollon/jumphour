"use client";

// workflow-board-ui task 6.5 (specs/workflow-board/spec.md "Render the board
// only from provider-derived state", failure "the provider cannot produce a
// board"; design.md Decision 8): when rendering the board throws — the
// provider could not read stored data — the view says the board could not be
// loaded and offers a retry. It never falls back to fixtures, to cards from
// an earlier render, or to an empty board that would imply there is no work:
// it renders no card, no lane, and no count.
//
// The thrown value is never shown. It can carry an internal message (a SQL
// error, a path), so nothing from it reaches the markup.
//
// Retry prefers Next's `retry` (re-requests the server render, then resets
// the boundary) and falls back to `reset` where only that is supplied.
import { Button } from "./components/ui/button";
import styles from "./error.module.css";

const BOARD_ERROR_TITLE = "The board could not be loaded";
const BOARD_ERROR_BODY =
  "Jumphour could not read this installation's stored data. Nothing was changed. Try again in a moment.";

interface BoardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}

export default function BoardError({ reset, retry }: BoardErrorProps) {
  return (
    <section className={styles.error} role="alert" aria-labelledby="board-error-title">
      <h1 id="board-error-title" className={styles.title}>
        {BOARD_ERROR_TITLE}
      </h1>
      <p className={styles.body}>{BOARD_ERROR_BODY}</p>
      <Button variant="primary" onClick={() => (retry ?? reset)()}>
        Retry
      </Button>
    </section>
  );
}
