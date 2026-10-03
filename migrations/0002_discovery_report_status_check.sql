-- Restrict discovery_reports.status to the three GitHub-canonical values the
-- OpenSpec discovery classifier emits (design.md Decision 5 / Decision 7 and
-- specs/openspec-discovery/spec.md "Classify OpenSpec support status"):
-- supported | unsupported | permission-blocked. Task 2.3.
--
-- SQLite's ALTER TABLE cannot add a CHECK constraint to an existing table, so
-- this recreates discovery_reports with the constraint in place. Safe here:
-- migration 0001 (this change, still unreleased) created the table and no
-- write path has populated it yet. CREATE TABLE / INSERT ... SELECT /
-- DROP TABLE / ALTER TABLE ... RENAME TO are plain ANSI SQL, valid on both
-- SQLite and Postgres (CLAUDE.md "Database portability").

CREATE TABLE discovery_reports_new (
  installation_id INTEGER NOT NULL REFERENCES installations (github_installation_id),
  github_repo_id INTEGER NOT NULL,
  default_branch TEXT,
  tip_sha TEXT,
  status TEXT NOT NULL CHECK (status IN ('supported', 'unsupported', 'permission-blocked')),
  config_path TEXT,
  schema TEXT,
  reason TEXT,
  observed_at TEXT NOT NULL,
  PRIMARY KEY (installation_id, github_repo_id)
);

INSERT INTO discovery_reports_new (
  installation_id, github_repo_id, default_branch, tip_sha, status,
  config_path, schema, reason, observed_at
)
SELECT
  installation_id, github_repo_id, default_branch, tip_sha, status,
  config_path, schema, reason, observed_at
FROM discovery_reports;

DROP TABLE discovery_reports;

ALTER TABLE discovery_reports_new RENAME TO discovery_reports;
