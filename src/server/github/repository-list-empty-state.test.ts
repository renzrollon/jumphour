// Task 8.2's verification: "Empty state when the user∩installation set is
// empty explains GitHub access / App install (not a missing board)."
// specs/github-app-installation/spec.md "Failure -- installation has no
// accessible repositories" and "Edge case -- GitHub user has no overlapping
// repository access".
import { describe, expect, it } from "vitest";
import { INSTALLATION_REQUIRED_EXPLANATION } from "./signed-in-surface";
import {
  NO_ACCESSIBLE_REPOSITORIES_EXPLANATION,
  resolveRepositoryListEmptyState,
} from "./repository-list-empty-state";

describe("resolveRepositoryListEmptyState", () => {
  it("explains that a GitHub App installation is required when none is selected", () => {
    const explanation = resolveRepositoryListEmptyState({ installationId: null, rowCount: 0 });

    expect(explanation).toBe(INSTALLATION_REQUIRED_EXPLANATION);
  });

  it("explains GitHub repository access, not a missing board, when an installation has zero accessible repositories", () => {
    const explanation = resolveRepositoryListEmptyState({ installationId: 1, rowCount: 0 });

    expect(explanation).toBe(NO_ACCESSIBLE_REPOSITORIES_EXPLANATION);
    const lower = explanation!.toLowerCase();
    expect(lower).toContain("github");
    expect(lower).not.toContain("role");
    expect(lower).not.toContain("board");
  });

  it("carries no explanation once the installation has at least one accessible repository", () => {
    const explanation = resolveRepositoryListEmptyState({ installationId: 1, rowCount: 3 });

    expect(explanation).toBeNull();
  });

  it("the two empty-state explanations are distinct copy, not one generic string", () => {
    expect(NO_ACCESSIBLE_REPOSITORIES_EXPLANATION).not.toBe(INSTALLATION_REQUIRED_EXPLANATION);
  });
});
