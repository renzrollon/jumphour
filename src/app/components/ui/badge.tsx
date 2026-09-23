// Task 5.5: a generic tone-labelled status tag (e.g. a health status such
// as "Healthy" / "Delayed" / "Unreachable"). This is distinct from
// SourceBadge (task 5.6), which is a closed GitHub/GitLab/Jira/Manual union
// with its own honesty rule. Badge's text label is required and is never
// replaced by the tone dot — specs/design-system/spec.md "Never convey
// state by color alone" requires two badges that share one tone to still
// read as distinct from their text alone.
import type { ReactNode } from "react";
import { ToneDot, type Tone } from "./tone-dot";
import styles from "./badge.module.css";

export interface BadgeProps {
  tone?: Tone;
  /** Show the tone dot alongside the label. Default true. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot = true, children, className }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      {dot ? <ToneDot tone={tone} /> : null}
      <span>{children}</span>
    </span>
  );
}
