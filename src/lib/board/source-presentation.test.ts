import { describe, expect, it } from "vitest";
import type { SourceKind as SourceBadgeVariant } from "../../app/components/ui/source-badge";
import type { SourceKind } from "./board-view-model";
import { assertNever, sourcePresentation, type BadgeVariant, type SourceBadgeKey } from "./source-presentation";

const ALL_SOURCE_KINDS = ["github-issue", "gitlab-issue", "jira", "manual"] as const satisfies readonly SourceKind[];
const ALL_BADGES = ["github", "gitlab", "jira", "manual"] as const satisfies readonly SourceBadgeKey[];

// Type-level: the tuples above cover their unions, and `BadgeVariant` is exactly
// the `SourceBadge` primitive's prop union.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const kindsCovered: Equal<(typeof ALL_SOURCE_KINDS)[number], SourceKind> = true;
const badgesCovered: Equal<(typeof ALL_BADGES)[number], SourceBadgeKey> = true;
const variantMatchesPrimitive: Equal<BadgeVariant, SourceBadgeVariant> = true;

describe("sourcePresentation", () => {
  it("labels every SourceKind exactly GitHub, GitLab, Jira · MCP, Manual", () => {
    expect(kindsCovered && badgesCovered && variantMatchesPrimitive).toBe(true);
    expect(ALL_SOURCE_KINDS.map((k) => sourcePresentation(k).label)).toEqual(["GitHub", "GitLab", "Jira · MCP", "Manual"]);
  });

  it("maps every manual-read badge to the same presentation as its SourceKind", () => {
    ALL_BADGES.forEach((badge, i) => {
      expect(sourcePresentation(badge)).toEqual(sourcePresentation(ALL_SOURCE_KINDS[i]!));
    });
  });

  it("gives each source its SourceBadge variant and marks only Jira as via MCP", () => {
    expect(ALL_SOURCE_KINDS.map((k) => sourcePresentation(k))).toEqual([
      { label: "GitHub", badgeVariant: "github", viaMcp: false },
      { label: "GitLab", badgeVariant: "gitlab", viaMcp: false },
      { label: "Jira · MCP", badgeVariant: "jira-mcp", viaMcp: true },
      { label: "Manual", badgeVariant: "manual", viaMcp: false },
    ]);
  });

  it("fails to compile when a SourceKind is left out of an exhaustive switch", () => {
    function missingManual(kind: SourceKind): string {
      switch (kind) {
        case "github-issue":
        case "gitlab-issue":
        case "jira":
          return kind;
        default:
          // @ts-expect-error — "manual" is unmapped, so `kind` is not `never` here.
          return assertNever(kind);
      }
    }
    expect(missingManual("jira")).toBe("jira");
    expect(() => missingManual("manual")).toThrow("Unmapped source: manual");
  });
});
