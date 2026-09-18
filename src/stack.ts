// Stack pin marker for task 1.1 (github-app-and-openspec-discovery).
// Actual application scaffolding happens in task 1.2.
export const STACK = {
  runtime: "node24",
  webFramework: "next",
  githubClient: "octokit",
  yamlParser: "yaml",
  sqlStore: "better-sqlite3",
} as const;
