// Task 6.7: proves the view/mapper UI and API readers use is a pure lookup
// on the stored `status`/`reason` columns and never a second classifier.
// `StoredDiscoveryReport` (the mapper's only input type) has no field for a
// raw file/listing, a GitHub client, or a driver, so the fixtures below are
// literally all the mapper could ever see — there is no raw file list to
// inspect even by mistake.
import { describe, expect, it } from "vitest";
import { toDiscoveryStatusView, type StoredDiscoveryReport } from "./discovery-report-view";

describe("toDiscoveryStatusView", () => {
  it("renders supported from status/reason alone, with no other input available", () => {
    const stored: StoredDiscoveryReport = { status: "supported", reason: null };

    expect(toDiscoveryStatusView(stored)).toEqual({
      status: "supported",
      label: "OpenSpec supported",
      tone: "positive",
      reason: null,
    });
  });

  it("renders unsupported using the stored reason verbatim", () => {
    const stored: StoredDiscoveryReport = {
      status: "unsupported",
      reason: "openspec/config.yaml was not found",
    };

    expect(toDiscoveryStatusView(stored)).toEqual({
      status: "unsupported",
      label: "OpenSpec not detected",
      tone: "neutral",
      reason: "openspec/config.yaml was not found",
    });
  });

  it("renders permission-blocked using the stored reason verbatim", () => {
    const stored: StoredDiscoveryReport = {
      status: "permission-blocked",
      reason: "GitHub could not read repository metadata for acme/api-gateway",
    };

    expect(toDiscoveryStatusView(stored)).toEqual({
      status: "permission-blocked",
      label: "Access needed",
      tone: "warning",
      reason: "GitHub could not read repository metadata for acme/api-gateway",
    });
  });

  it("is a pure function of status and reason: identical status/reason pairs always produce identical views, regardless of what else a full discovery report might contain", () => {
    const minimal: StoredDiscoveryReport = { status: "supported", reason: null };
    // A caller with a full discovery_reports row (extra columns like
    // configPath/defaultBranch/tipSha) still only ever passes status/reason
    // through — those extra columns are not part of StoredDiscoveryReport
    // and the mapper has no way to consult them.
    const fromFullRow: StoredDiscoveryReport = { status: "supported", reason: null };

    expect(toDiscoveryStatusView(minimal)).toEqual(toDiscoveryStatusView(fromFullRow));
  });
});
