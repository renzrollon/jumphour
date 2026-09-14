## 1. Application bootstrap

- [ ] 1.1 Choose the web runtime, framework, GitHub HTTP client, YAML parser, and SQL database; record exact pinned versions (no `^`/`~`/`latest`) in the app manifest and verify install/lockfile succeeds
- [ ] 1.2 Scaffold the web app with a server that can hold secrets from the environment and a SQL store, and verify the empty app boots and the database migrator runs
- [ ] 1.3 Add a documented local GitHub App Setup URL and OAuth callback (localhost is enough for the first org) and verify the callback routes respond without requiring Marketplace listing

## 2. Persistence and canonical identities

- [ ] 2.1 Add tables for `installations`, `users`, `sessions`, `installation_repositories`, and `discovery_reports` keyed as in design.md, and verify migrations apply on a clean database
- [ ] 2.2 Enforce unique `(installation_id, github_repo_id)` and unique `github_installation_id`, and verify inserting the same GitHub repo id twice updates `full_name` instead of creating a second row
- [ ] 2.3 Store OpenSpec support status only as `supported` | `unsupported` | `permission-blocked`, and verify invalid status values are rejected by the schema or write path

## 3. GitHub App install and sign-in

- [ ] 3.1 Implement GitHub App JWT and installation-token minting that send `X-GitHub-Api-Version: 2026-03-10`, and verify a unit test with a fake GitHub clock/header asserts that header on outgoing calls
- [ ] 3.2 Persist an installation from the Setup URL query (`installation_id`, `setup_action`) and verify a test records the installation without calling GitHub write APIs
- [ ] 3.3 Recover a missed Setup redirect by listing `GET /user/installations` after sign-in and persisting unknown ids, and verify a signed-in user with an install GitHub knows about gets a stored installation row
- [ ] 3.4 Implement GitHub App OAuth sign-in that creates a session bound to `github_user_id`, and verify denied/cancelled OAuth creates no session and stores no token
- [ ] 3.5 When the user has no overlapping installations, show that a GitHub App installation is required, and verify the signed-in surface lists zero repositories with that explanation

## 4. Accessible repository list

- [ ] 4.1 List repositories via user-to-server `GET /user/installations/{id}/repositories` (not the installation token), and verify a fixture where the install includes two repos and the user can access one lists only the overlapping repo
- [ ] 4.2 Resolve user-typed `owner/name` through GitHub-canonical `id` + `full_name`, and verify `Acme/API-Gateway` and `acme/api-gateway` map to one `github_repo_id`
- [ ] 4.3 When GitHub listing fails, show a retryable error and keep an empty/unknown list rather than a guessed set, and verify the failure test does not persist invented repositories
- [ ] 4.4 Refuse requests for a repository not in the current installation, and verify the handler does not call GitHub contents APIs for that repo

## 5. Permission snapshot

- [ ] 5.1 Read installation permissions from `GET /app/installations/{id}` and require `metadata: read`, `contents: write`, and `pull_requests: write`, and verify a missing `contents` write reports that permission by name
- [ ] 5.2 On a later permission check, overwrite the stored snapshot (do not keep “sufficient” after revoke), and verify a revoked-permission fixture reports the current gap
- [ ] 5.3 Add a test harness that records every GitHub HTTP method used during list + discovery, and verify no `POST`/`PUT`/`PATCH`/`DELETE` is issued to repo, git, contents, or pull-request paths

## 6. OpenSpec discovery classifier

- [ ] 6.1 Implement a single classifier function that reads default branch + tip SHA, `openspec/config.yaml` on that ref, and whether `openspec/changes/` is a directory, and verify a happy-path fixture with parseable config + changes dir returns `supported` with path and optional `schema`
- [ ] 6.2 Return `unsupported` (not `supported`) when only `openspec/config.yml` exists, and verify the reason mentions `openspec/config.yaml` was not found
- [ ] 6.3 Return `unsupported` when config YAML is invalid or `openspec/changes/` is missing, and verify distinct reasons for parse failure vs missing change layout
- [ ] 6.4 Look up OpenSpec files on the GitHub default branch even when it is not `main`/`master`, and verify a `trunk` fixture does not query `main`
- [ ] 6.5 Return `permission-blocked` when metadata or contents reads are 401/403, without inventing a default branch or writing files, and verify the report names the access error
- [ ] 6.6 Persist reports per `(installation_id, github_repo_id)` and refresh by overwrite, and verify two concurrent discovery runs on the same fixture emit the same status and still issue no GitHub writes
- [ ] 6.7 UI and API readers consume stored `status` and `reason` only (no second parser), and verify a unit test of the view/mapper never inspects raw file lists to decide support

## 7. Tenancy

- [ ] 7.1 Scope every repository and discovery query by current `installation_id`, and verify a user in installation A cannot read B’s repository names, ids, or reports
- [ ] 7.2 Add an installation switcher for a GitHub user present in two installations, and verify switching from A to B replaces the list (no merge)
- [ ] 7.3 Isolation of discovery: a report stored under A for a given GitHub repo id is not returned under B, and verify B either has its own report or none

## 8. Thin signed-in surface

- [ ] 8.1 Build sign-in, optional installation picker, and a repository table showing canonical `full_name`, default branch, status, and reason, and verify a populated fixture renders those fields and does not render Idea / OpenSpec change / In progress / PR/MR columns
- [ ] 8.2 Empty state when the user∩installation set is empty explains GitHub access / App install (not a missing board), and verify the copy in that state
- [ ] 8.3 `unsupported` and `permission-blocked` rows show status + reason with no Promote / create-PR / write-OpenSpec action, and verify those actions are absent from the page
- [ ] 8.4 Wire Refresh to re-run listing and discovery for the current installation, and verify a changed GitHub `full_name` for the same repo id updates the existing row instead of inserting a duplicate
