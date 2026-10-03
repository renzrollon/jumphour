"use client";

// Task 4.2 (specs/workflow-board/spec.md "Offer manual reads only on the Idea
// and PR/MR lanes"): the menu behind Load ideas and Fetch PRs/MRs, rendered
// from the provider's `ManualRead`.
//
// - Available: a menu-button whose menu states the read-only notice verbatim,
//   then one text-labelled row per provider option, marked "MCP" when the
//   option is read via MCP. Choosing a row calls `onManualRead(kind, optionId)`
//   once and closes the menu.
// - Unavailable: a disabled button with the provider's reason as visible text
//   beside it. A disabled button cannot be activated, so it opens no menu and
//   requests nothing.
//
// Whether a lane may carry this control at all is the lane header's call, not
// this component's.
import { useId } from "react";
import type { ManualRead, ManualReadKind } from "../../../lib/board/board-view-model";
import { sourcePresentation } from "../../../lib/board/source-presentation";
import { Menu, type MenuItem } from "../ui/menu";
import type { TransientStateProps } from "../ui/transient";
import styles from "./manual-read-menu.module.css";

export interface ManualReadCopy {
  /** Visible trigger text. */
  trigger: string;
  /** Accessible name of the menu. */
  menuLabel: string;
  /** The read-only notice at the top of the menu. */
  notice: string;
}

export const MANUAL_READ_COPY: Readonly<Record<ManualReadKind, ManualReadCopy>> = {
  "load-ideas": {
    trigger: "Load ideas",
    menuLabel: "Load ideas from",
    notice: "Reads the selected source now and captures snapshots. Never writes back.",
  },
  "fetch-pull-requests": {
    trigger: "Fetch PRs/MRs",
    menuLabel: "Fetch from",
    notice: "Read-only MCP fetch. No comments, reviews, or labels.",
  },
};

const DOT_CLASS = {
  github: styles.dotGithub,
  gitlab: styles.dotGitlab,
  "jira-mcp": styles.dotJira,
  manual: styles.dotManual,
} as const;

export interface ManualReadMenuProps extends TransientStateProps {
  manualRead: ManualRead;
  onManualRead?: (kind: ManualReadKind, optionId: string) => void;
  /** "compact" in a lane header, "regular" in the toolbar. Default "regular". */
  size?: "compact" | "regular";
}

export function ManualReadMenu({ manualRead, onManualRead, size = "regular", ...state }: ManualReadMenuProps) {
  const reasonId = useId();
  const copy = MANUAL_READ_COPY[manualRead.kind];
  const triggerClass = [styles.trigger, size === "compact" ? styles.compact : null].filter(Boolean).join(" ");

  if (manualRead.availability.status === "unavailable") {
    return (
      <div className={styles.unavailable}>
        <button type="button" className={triggerClass} disabled aria-describedby={reasonId}>
          {copy.trigger}
        </button>
        <span id={reasonId} className={styles.reason}>
          {manualRead.availability.reason}
        </span>
      </div>
    );
  }

  const { kind } = manualRead;
  const items: MenuItem[] = manualRead.options.map((option) => ({
    id: option.id,
    label: (
      <span className={styles.option}>
        <span className={[styles.dot, DOT_CLASS[sourcePresentation(option.badge).badgeVariant]].join(" ")} aria-hidden="true" />
        <span>{option.label}</span>
        {option.viaMcp ? (
          <span className={styles.mcp}>
            <span className={styles.visuallyHidden}>, read via</span> MCP
          </span>
        ) : null}
      </span>
    ),
    onSelect: () => onManualRead?.(kind, option.id),
  }));

  return (
    <Menu
      {...state}
      label={copy.menuLabel}
      description={<span className={styles.notice}>{copy.notice}</span>}
      items={items}
      className={styles.menu}
      renderTrigger={(trigger) => (
        <button {...trigger} className={triggerClass}>
          {copy.trigger}
          <svg width={10} height={10} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}
    />
  );
}
