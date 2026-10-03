// Task 5.6: the source badge, over a closed union of the four sources an item
// can come from (specs/design-system/spec.md "Label every source badge with
// text"). The visible text label is the identification; the accent is
// decoration confined to the badge element itself (its own background and
// text color — never a descendant, ancestor, or sibling rule), so the card or
// row it sits on keeps its neutral surface. Stripping the accent class, or a
// forced-colors rendering, leaves the text and `data-source` intact. Jira is a
// source reached through MCP, not a brand: it reads `Jira · MCP` in the same
// restrained soft treatment as GitLab.
import styles from "./source-badge.module.css";

export const SOURCE_KINDS = ["github", "gitlab", "jira-mcp", "manual"] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  github: "GitHub",
  gitlab: "GitLab",
  "jira-mcp": "Jira · MCP",
  manual: "Manual",
};

const ACCENT_CLASS: Readonly<Record<SourceKind, string | undefined>> = {
  github: styles.github,
  gitlab: styles.gitlab,
  "jira-mcp": styles.jira,
  manual: styles.manual,
};

export interface SourceBadgeProps {
  source: SourceKind;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const classes = [styles.badge, ACCENT_CLASS[source], className].filter(Boolean).join(" ");
  return (
    <span className={classes} data-source={source}>
      {SOURCE_LABELS[source]}
    </span>
  );
}
