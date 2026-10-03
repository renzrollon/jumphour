"use client";

// workflow-board-ui task 7.3 (design.md Decision 8, "Manual-read pending";
// Decision 10): the client half of /dev/ui/board. It shows the persistent
// "Preview — fixture data" label with the displayed scenario and links to the
// other five, and renders the real `BoardScreen` over the scenario's fixture
// view, opened with the scenario's preset filters. Its manual-read handler is preview-only — production passes none —
// and simulates a read the way the prototype's `startLoading` does: the board
// is pending for 1.4 s, then shows the same view again. Nothing is read.
import { useCallback, useEffect, useRef, useState } from "react";
import { BoardScreen, type BoardScreenProps } from "../../../components/board/board-screen";
import { BOARD_SCENARIOS, type BoardScenario } from "../fixtures/board";
import { PREVIEW_LABEL } from "../primitives-gallery";
import styles from "./board-preview.module.css";

/** How long the preview's simulated manual read stays pending (prototype `startLoading`). */
export const SIMULATED_READ_MS = 1400;

export interface BoardPreviewProps {
  scenario: BoardScenario;
  shell: NonNullable<BoardScreenProps["shell"]>;
}

export function BoardPreview({ scenario, shell }: BoardPreviewProps) {
  const [reading, setReading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const simulateRead = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    setReading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setReading(false);
    }, SIMULATED_READ_MS);
  }, []);

  return (
    <>
      <div className={styles.strip} role="note" aria-label="Preview">
        <p className={styles.label}>
          {PREVIEW_LABEL} · Scenario: <strong data-preview-scenario={scenario.name}>{scenario.name}</strong>
        </p>
        <nav className={styles.scenarios} aria-label="Board scenarios">
          {BOARD_SCENARIOS.map((name) => (
            <a
              key={name}
              className={styles.scenario}
              href={`?scenario=${name}`}
              aria-current={name === scenario.name ? "page" : undefined}
            >
              {name}
            </a>
          ))}
        </nav>
      </div>
      <BoardScreen
        view={scenario.view}
        shell={shell}
        pending={scenario.pending || reading}
        onManualRead={simulateRead}
        initialFilters={scenario.filters}
      />
    </>
  );
}
