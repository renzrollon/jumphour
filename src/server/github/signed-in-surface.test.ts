// Task 3.5: when the user has no overlapping installations, the signed-in
// surface lists zero repositories with an explanation that a GitHub App
// installation is required — not an unqualified empty list.
// specs/github-app-installation/spec.md "Failure — App is not installed".
import { describe, expect, it } from "vitest";
import { INSTALLATION_REQUIRED_EXPLANATION, resolveSignedInSurface } from "./signed-in-surface";

describe("resolveSignedInSurface", () => {
  it("lists zero repositories with the installation-required explanation when there is no overlap", () => {
    const surface = resolveSignedInSurface({ overlappingInstallationCount: 0 });

    expect(surface.repositories).toEqual([]);
    expect(surface.explanation).toBe(INSTALLATION_REQUIRED_EXPLANATION);
  });

  it("carries no explanation once at least one installation overlaps", () => {
    const surface = resolveSignedInSurface({ overlappingInstallationCount: 1 });

    expect(surface.repositories).toEqual([]);
    expect(surface.explanation).toBeNull();
  });

  it("the explanation names GitHub App installation, not a Jumphour role or missing repo access", () => {
    expect(INSTALLATION_REQUIRED_EXPLANATION.toLowerCase()).toContain("github app");
    expect(INSTALLATION_REQUIRED_EXPLANATION.toLowerCase()).not.toContain("role");
  });
});
