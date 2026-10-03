// Task 3.7 (specs/workflow-board/spec.md "Distinguish first-use, not-enabled,
// filtered-empty, and loading states"): the board with no cards at all.
//
// Two variants, chosen from the provider's availabilities — never from
// anything the UI infers:
//   - first-use: at least one of Load ideas / Compose idea is available. It
//     names the two paths (read-only snapshots from a source, or composing
//     here) and offers both actions, each enabled only if available.
//   - not-enabled: both are unavailable. It says idea intake is not enabled
//     for this installation yet, and shows both actions disabled with the
//     provider's reasons as visible text.
// Neither variant shows a sample or placeholder card.
//
// The cats accent is decorative: both illustrations are always in the markup,
// hidden from assistive technology, and the root `data-jh-cats` hook picks
// which one shows, so cats never change copy, controls, or names.
import { useId } from "react";
import type { Availability } from "../../../lib/board/board-view-model";
import { Button } from "../ui/button";
import { Illustration } from "../ui/illustration";
import styles from "./empty-board.module.css";

export const FIRST_USE_TITLE = "No ideas on this board yet";
export const FIRST_USE_BODY =
  "Load ideas from GitHub Issues, GitLab issues, or Jira via MCP to capture read-only snapshots, or compose one here. Everything downstream is derived from repository and host evidence.";
export const NOT_ENABLED_TITLE = "Idea intake is not enabled for this installation yet";
export const NOT_ENABLED_BODY =
  "Nothing can be loaded or composed here until it is. Once enabled, ideas arrive as read-only snapshots from GitHub Issues, GitLab issues, or Jira via MCP, or are composed here, and everything downstream is derived from repository and host evidence.";

export interface EmptyBoardProps {
  /** Availability of Load ideas (the Idea lane's `manualRead`). */
  loadIdeas: Availability;
  /** `BoardViewModel.compose`. */
  compose: Availability;
  onLoadIdeas?: () => void;
  onCompose?: () => void;
}

export function EmptyBoard({ loadIdeas, compose, onLoadIdeas, onCompose }: EmptyBoardProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const notEnabled = loadIdeas.status === "unavailable" && compose.status === "unavailable";

  // One visible line per distinct reason; each disabled action points at its own.
  const reasons: string[] = [];
  const reasonId = (availability: Availability): string | undefined => {
    if (availability.status === "available") return undefined;
    let index = reasons.indexOf(availability.reason);
    if (index === -1) index = reasons.push(availability.reason) - 1;
    return `${id}-reason-${index}`;
  };
  const loadReasonId = reasonId(loadIdeas);
  const composeReasonId = reasonId(compose);

  return (
    <section
      className={styles.emptyBoard}
      aria-labelledby={headingId}
      data-variant={notEnabled ? "not-enabled" : "first-use"}
    >
      <div className={styles.inner}>
        <Illustration className={styles.catsOnly}>
          <svg width={72} height={48} viewBox="0 0 72 48" focusable="false">
            <path
              d="M14 40c-6 0-9-5-7-11 2-5 6-7 6-14l6 6h10l6-6c0 7 4 9 6 14 2 6-1 11-7 11H14z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="M38 38h24c5 0 7-4 5-7l-6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="18" cy="28" r="1.2" fill="currentColor" />
            <circle cx="28" cy="28" r="1.2" fill="currentColor" />
          </svg>
        </Illustration>
        <Illustration className={styles.catsOff}>
          <span className={styles.slot} />
          <span className={styles.slot} />
          <span className={styles.slot} />
          <span className={styles.slot} />
        </Illustration>

        <h2 id={headingId} className={styles.title}>
          {notEnabled ? NOT_ENABLED_TITLE : FIRST_USE_TITLE}
        </h2>
        <p className={styles.body}>{notEnabled ? NOT_ENABLED_BODY : FIRST_USE_BODY}</p>

        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={loadIdeas.status === "unavailable"}
            aria-describedby={loadReasonId}
            onClick={loadIdeas.status === "available" ? onLoadIdeas : undefined}
          >
            Load ideas
          </Button>
          <Button
            variant="primary"
            disabled={compose.status === "unavailable"}
            aria-describedby={composeReasonId}
            onClick={compose.status === "available" ? onCompose : undefined}
          >
            Compose idea
          </Button>
        </div>

        {reasons.map((reason, index) => (
          <p key={reason} id={`${id}-reason-${index}`} className={styles.reason}>
            {reason}
          </p>
        ))}
      </div>
    </section>
  );
}
