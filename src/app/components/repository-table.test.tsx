// Task 8.1's verification: "a populated fixture renders those fields and
// does not render Idea / OpenSpec change / In progress / PR/MR columns" —
// specs/github-app-installation/spec.md "Present a thin signed-in
// repository and discovery surface": "they see each accessible repository
// with its discovery status" AND "they do not see workflow board columns."
//
// Renders the real component to static markup (react-dom/server, already a
// pinned runtime dependency — no jsdom/testing-library needed for a
// server-rendered, non-interactive table) and asserts on the resulting
// HTML string.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { REPOSITORY_TABLE_COLUMNS, RepositoryTable } from "./repository-table";
import type { RepositoryTableRow } from "../../server/github/repository-table-view";

const POPULATED_FIXTURE: RepositoryTableRow[] = [
  {
    githubRepoId: 101,
    fullName: "acme/api-gateway",
    defaultBranch: "main",
    status: "supported",
    statusLabel: "OpenSpec supported",
    reason: null,
  },
  {
    githubRepoId: 102,
    fullName: "acme/customer-web",
    defaultBranch: "trunk",
    status: "permission-blocked",
    statusLabel: "Access needed",
    reason: "GitHub denied reading openspec/config.yaml (403)",
  },
];

describe("RepositoryTable", () => {
  it("renders canonical full_name, default branch, status, and reason for a populated fixture", () => {
    const html = renderToStaticMarkup(<RepositoryTable rows={POPULATED_FIXTURE} />);

    expect(html).toContain("acme/api-gateway");
    expect(html).toContain("main");
    expect(html).toContain("OpenSpec supported");

    expect(html).toContain("acme/customer-web");
    expect(html).toContain("trunk");
    expect(html).toContain("Access needed");
    expect(html).toContain("GitHub denied reading openspec/config.yaml (403)");
  });

  it("renders exactly the four repository-table columns, never a workflow board column", () => {
    const html = renderToStaticMarkup(<RepositoryTable rows={POPULATED_FIXTURE} />);

    expect(REPOSITORY_TABLE_COLUMNS).toEqual(["Repository", "Default branch", "Status", "Reason"]);
    for (const column of REPOSITORY_TABLE_COLUMNS) {
      expect(html).toContain(column);
    }

    for (const boardColumn of ["Idea", "OpenSpec change", "In progress", "PR/MR"]) {
      expect(html).not.toContain(boardColumn);
    }
  });

  it("renders an empty table body, never invented rows, when there is nothing to show", () => {
    const html = renderToStaticMarkup(<RepositoryTable rows={[]} />);

    expect(html).toContain("<table");
    expect(html).not.toMatch(/<td/);
  });
});

// Task 8.3: specs/github-app-installation/spec.md "Edge case -- discovery
// status is shown without promoting": "GIVEN a listed repository whose
// discovery status is unsupported or permission-blocked ... THEN the status
// and reason are visible AND the system offers no action that writes
// OpenSpec files or opens a pull request." RepositoryTable's fixed column
// set (REPOSITORY_TABLE_COLUMNS, asserted above) already structurally
// carries no action column for any row -- this suite proves that invariant
// explicitly for exactly the two statuses the spec calls out, rather than
// relying only on the general board-column check above.
const UNSUPPORTED_AND_BLOCKED_FIXTURE: RepositoryTableRow[] = [
  {
    githubRepoId: 201,
    fullName: "acme/legacy-tools",
    defaultBranch: "main",
    status: "unsupported",
    statusLabel: "OpenSpec not detected",
    reason: "openspec/config.yaml was not found on main",
  },
  {
    githubRepoId: 202,
    fullName: "acme/customer-web",
    defaultBranch: "trunk",
    status: "permission-blocked",
    statusLabel: "Access needed",
    reason: "GitHub refused to read openspec/config.yaml on trunk",
  },
];

const WRITE_SHAPED_ACTION_STRINGS = [
  "Promote",
  "Create PR",
  "Create pull request",
  "Open PR",
  "Open pull request",
  "Write OpenSpec",
  "Initialize OpenSpec",
];

describe("RepositoryTable — unsupported and permission-blocked rows offer no write-shaped action", () => {
  it("renders status and reason for both unsupported and permission-blocked rows", () => {
    const html = renderToStaticMarkup(<RepositoryTable rows={UNSUPPORTED_AND_BLOCKED_FIXTURE} />);

    expect(html).toContain("acme/legacy-tools");
    expect(html).toContain("OpenSpec not detected");
    expect(html).toContain("openspec/config.yaml was not found on main");

    expect(html).toContain("acme/customer-web");
    expect(html).toContain("Access needed");
    expect(html).toContain("GitHub refused to read openspec/config.yaml on trunk");
  });

  it("never renders a Promote / create-PR / write-OpenSpec action for those rows", () => {
    const html = renderToStaticMarkup(<RepositoryTable rows={UNSUPPORTED_AND_BLOCKED_FIXTURE} />);

    expect(html).not.toMatch(/<button/);
    expect(html).not.toMatch(/<a\s/);
    for (const action of WRITE_SHAPED_ACTION_STRINGS) {
      expect(html).not.toContain(action);
    }
  });

  it("REPOSITORY_TABLE_COLUMNS carries no action column at all, for any row's status", () => {
    // Structural guarantee, not just an absence-of-string check: an action
    // column would have to appear in this fixed tuple before any row could
    // render one (see repository-table.tsx's module comment).
    expect(REPOSITORY_TABLE_COLUMNS).not.toContain("Action");
    expect(REPOSITORY_TABLE_COLUMNS).not.toContain("Actions");
    expect(REPOSITORY_TABLE_COLUMNS.length).toBe(4);
  });
});
