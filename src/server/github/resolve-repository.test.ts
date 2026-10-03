// Task 4.2: specs/github-app-installation/spec.md "Edge case — mixed-case
// owner or name resolves to one canonical repository": GitHub's canonical
// identity is `acme/api-gateway`; a user referring to it as
// `Acme/API-Gateway` or `acme/api-gateway` must resolve to the same
// `github_repo_id`, and later readers see one repository, not two.
import { describe, expect, it } from "vitest";
import { resolveRepositoryByOwnerName } from "./resolve-repository";
import type { GithubInstallationRepository } from "./oauth";

const repositories: GithubInstallationRepository[] = [
  { githubRepoId: 1, fullName: "acme/api-gateway" },
  { githubRepoId: 2, fullName: "acme/customer-web" },
];

describe("resolveRepositoryByOwnerName", () => {
  it("resolves mixed-case and lowercase spellings of the same repository to one github_repo_id", () => {
    const mixedCase = resolveRepositoryByOwnerName({ repositories, ownerName: "Acme/API-Gateway" });
    const lowerCase = resolveRepositoryByOwnerName({ repositories, ownerName: "acme/api-gateway" });

    expect(mixedCase).toEqual({ resolved: true, repository: { githubRepoId: 1, fullName: "acme/api-gateway" } });
    expect(lowerCase).toEqual({ resolved: true, repository: { githubRepoId: 1, fullName: "acme/api-gateway" } });
    expect(mixedCase.resolved && mixedCase.repository.githubRepoId).toBe(
      lowerCase.resolved && lowerCase.repository.githubRepoId,
    );
  });

  it("returns the canonical full_name casing, not the user-typed casing", () => {
    const outcome = resolveRepositoryByOwnerName({ repositories, ownerName: "ACME/API-GATEWAY" });

    expect(outcome).toEqual({ resolved: true, repository: { githubRepoId: 1, fullName: "acme/api-gateway" } });
  });

  it("does not resolve a repository absent from the canonical list", () => {
    const outcome = resolveRepositoryByOwnerName({ repositories, ownerName: "acme/secret-ledger" });

    expect(outcome).toEqual({ resolved: false });
  });
});
