// Task 6.7: design.md line 127 ("[UI recomputes support] -> Duplicate
// classifiers drift. Mitigation: one classifier; UI reads `status`/`reason`
// only") and specs/openspec-discovery/spec.md's read-side scenarios. Task
// 6.1's classifyOpenSpecSupport (via task 6.6's upsertDiscoveryReport) is the
// *only* place that inspects the GitHub config file or the `openspec/changes`
// directory listing to decide support. Every UI or API reader downstream
// must render from the already-computed `status`/`reason` columns on the
// stored `discovery_reports` row and must not re-derive support from GitHub
// data of its own.
//
// `StoredDiscoveryReport` intentionally carries only `status` and `reason` —
// no `configPath`/`defaultBranch`/`tipSha`, and certainly no raw file/listing
// data — so this mapper cannot reach for a second signal even by accident.
// That is what the unit test in ./discovery-report-view.test.ts proves.
import type { OpenSpecSupportStatus } from "./classify-openspec-support";

export interface StoredDiscoveryReport {
  status: OpenSpecSupportStatus;
  reason: string | null;
}

export type DiscoveryStatusTone = "positive" | "neutral" | "warning";

export interface DiscoveryStatusView {
  status: OpenSpecSupportStatus;
  label: string;
  tone: DiscoveryStatusTone;
  /** Passed through verbatim from the stored row; never re-derived. */
  reason: string | null;
}

const LABELS: Record<OpenSpecSupportStatus, string> = {
  supported: "OpenSpec supported",
  unsupported: "OpenSpec not detected",
  "permission-blocked": "Access needed",
};

const TONES: Record<OpenSpecSupportStatus, DiscoveryStatusTone> = {
  supported: "positive",
  unsupported: "neutral",
  "permission-blocked": "warning",
};

/**
 * Maps a stored `discovery_reports` row to the view UI and API readers
 * render — a lookup on `status`, plus the stored `reason` passed through
 * unchanged. Takes no GitHub client, driver, or file-listing input, so it
 * cannot classify anything itself.
 */
export function toDiscoveryStatusView(report: StoredDiscoveryReport): DiscoveryStatusView {
  return {
    status: report.status,
    label: LABELS[report.status],
    tone: TONES[report.status],
    reason: report.reason,
  };
}
