"use client";

// Task 4.4 (specs/workflow-board/spec.md "Search cards across all lanes";
// design.md Decision 3): the board's search field, made for the shell's
// search slot (`AppShell`'s `search` prop). It is controlled — the board
// screen owns the query and filters with `normalizeQuery`, so this field only
// shows the raw text and reports every edit. Only the board passes it; on
// `/repositories` the slot stays empty.
import { useId } from "react";
import styles from "./board-search.module.css";

export const BOARD_SEARCH_LABEL = "Search ideas, specs, PRs, and MRs";

export interface BoardSearchProps {
  /** The raw query as typed. */
  value: string;
  onChange: (query: string) => void;
}

export function BoardSearch({ value, onChange }: BoardSearchProps) {
  const inputId = useId();
  return (
    <div role="search" className={styles.search}>
      <label htmlFor={inputId} className={styles.visuallyHidden}>
        {BOARD_SEARCH_LABEL}
      </label>
      <svg className={styles.icon} width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.2 9.2L12.5 12.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <input
        id={inputId}
        type="search"
        className={styles.input}
        placeholder={BOARD_SEARCH_LABEL}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
