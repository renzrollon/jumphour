// Source presentation (design.md Decision 4, "Source presentation"). The one
// mapping from a card's `SourceKind`, or a manual-read option's `badge`, to
// its visible label, its `SourceBadge` variant, and whether it is read via
// MCP. Card badges, source filter options, manual-read menu rows, and
// filtered-empty copy all read from here.
import type { ManualRead, SourceKind } from "./board-view-model";

/** A manual-read option's badge, as the provider reports it. */
export type SourceBadgeKey = ManualRead["options"][number]["badge"];

/**
 * The `SourceBadge` primitive's `source` prop (`src/app/components/ui/source-badge.tsx`).
 * Spelled out here so this module imports nothing from the app layer; a test
 * asserts the two unions are identical.
 */
export type BadgeVariant = "github" | "gitlab" | "jira-mcp" | "manual";

export interface SourcePresentation {
  label: "GitHub" | "GitLab" | "Jira · MCP" | "Manual";
  badgeVariant: BadgeVariant;
  viaMcp: boolean;
}

const GITHUB: SourcePresentation = { label: "GitHub", badgeVariant: "github", viaMcp: false };
const GITLAB: SourcePresentation = { label: "GitLab", badgeVariant: "gitlab", viaMcp: false };
const JIRA: SourcePresentation = { label: "Jira · MCP", badgeVariant: "jira-mcp", viaMcp: true };
const MANUAL: SourcePresentation = { label: "Manual", badgeVariant: "manual", viaMcp: false };

/** Compile-time exhaustiveness: reaching this with a non-`never` value is a type error. */
export function assertNever(value: never): never {
  throw new Error(`Unmapped source: ${String(value)}`);
}

export function sourcePresentation(kind: SourceKind | SourceBadgeKey): SourcePresentation {
  switch (kind) {
    case "github-issue":
    case "github":
      return GITHUB;
    case "gitlab-issue":
    case "gitlab":
      return GITLAB;
    case "jira":
      return JIRA;
    case "manual":
      return MANUAL;
    default:
      return assertNever(kind);
  }
}
