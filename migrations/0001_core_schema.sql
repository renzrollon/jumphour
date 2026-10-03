-- Core product tables: GitHub App installations, signed-in users, sessions,
-- the repositories each installation can access, and OpenSpec discovery
-- reports. Columns and keys follow design.md Decision 7 ("Persistence
-- (minimum product database)").
--
-- Plain ANSI SQL only (CLAUDE.md "Database portability"): no jsonb, no
-- SQLite-only or Postgres-only syntax. Timestamps are ISO-8601 TEXT, matching
-- schema_migrations.applied_at in src/server/db/migrate.ts.
--
-- Scope note: this migration establishes the tables and their primary/
-- foreign keys only. A `status` value CHECK and any additional uniqueness
-- beyond the keys below are added by later migrations (tasks 2.2, 2.3).

-- One row per GitHub App installation. `github_installation_id` is GitHub's
-- own id and is the tenancy key used throughout the schema (Decision 3), so
-- it is the primary key here rather than a separate surrogate id.
CREATE TABLE installations (
  github_installation_id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  account_login TEXT NOT NULL,
  permission_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One row per GitHub user who has signed in. `github_user_id` is GitHub's
-- own id and is the primary key (Decision 7: "github_user_id (unique)").
CREATE TABLE users (
  github_user_id INTEGER PRIMARY KEY,
  login TEXT NOT NULL
);

-- One row per signed-in session. `id` is an app-generated opaque token —
-- design.md does not name a natural key for this table.
-- `installation_id` is nullable: a session exists before any installation
-- is chosen (e.g. zero overlapping installations, task 3.5).
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER NOT NULL REFERENCES users (github_user_id),
  installation_id INTEGER REFERENCES installations (github_installation_id)
);

-- The repositories a given installation exposes, keyed by the same tuple
-- design.md uses to describe this table: (installation_id, github_repo_id).
-- `full_name` is GitHub's display alias and MAY change (Decision 4).
CREATE TABLE installation_repositories (
  installation_id INTEGER NOT NULL REFERENCES installations (github_installation_id),
  github_repo_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (installation_id, github_repo_id)
);

-- The latest OpenSpec discovery report per (installation_id, github_repo_id)
-- (Decision 6: refresh overwrites, cache is not authoritative). Columns that
-- are only known once GitHub reads succeed are nullable: a permission-blocked
-- report may never resolve a default branch or tip SHA (Decision 6, step 1).
-- `status` is unconstrained TEXT here; task 2.3 restricts it to
-- supported | unsupported | permission-blocked.
CREATE TABLE discovery_reports (
  installation_id INTEGER NOT NULL REFERENCES installations (github_installation_id),
  github_repo_id INTEGER NOT NULL,
  default_branch TEXT,
  tip_sha TEXT,
  status TEXT NOT NULL,
  config_path TEXT,
  schema TEXT,
  reason TEXT,
  observed_at TEXT NOT NULL,
  PRIMARY KEY (installation_id, github_repo_id)
);
