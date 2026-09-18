# GitHub App local Setup URL and OAuth callback

Task 1.3 of `github-app-and-openspec-discovery`. Localhost is enough for the
first organization (design.md: "apply can start with a documented local
callback for the first organization" — Deploy Considerations). No public
Marketplace listing is required for either URL to work; a private GitHub App
installed on one org can point both at `localhost` during development.

When registering (or editing) the private GitHub App at
`https://github.com/settings/apps/<your-app>`, set:

| GitHub App setting | Local value |
|---|---|
| Setup URL | `http://localhost:3000/api/github/setup` |
| Callback URL (OAuth) | `http://localhost:3000/api/github/oauth/callback` |
| "Redirect on update" | on — resends the admin here after permission changes too |

## What each route does today

- `GET /api/github/setup` — where GitHub redirects the installing admin
  after install/update, with `installation_id` and `setup_action` query
  params. It resolves the installation's account via the App-JWT
  `GET /app/installations/{id}` read (task 3.1) and upserts the
  `installations` row (task 3.2); the JSON response's `recorded` field
  reports whether that write happened, with `reason` set when it did not
  (missing/invalid `installation_id`, a pending `setup_action=request`, or
  `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` not configured).
- `GET /api/github/oauth/callback` — where GitHub redirects the signed-in
  user after authorizing the App's user-to-server OAuth, with `code` and
  `state` query params (or `error` when sign-in is denied or cancelled). It
  exchanges `code` for a user access token, resolves the identity via
  `GET /user`, and creates a session bound to `github_user_id` (task 3.4);
  the JSON response's `signedIn` field reports whether that happened, with
  `reason` set when it did not. A successful sign-in sets an httpOnly
  `jumphour_session` cookie; the raw GitHub access token itself is never
  persisted.

Both routes are `export const dynamic = "force-dynamic"` (never statically
optimized) and respond even with no query params or no GitHub secrets
configured, so they can be exercised with `curl` alone once `npm run dev` is
running:

```sh
curl "http://localhost:3000/api/github/setup?installation_id=123&setup_action=install"
curl "http://localhost:3000/api/github/oauth/callback?code=abc&state=xyz"
```

Both return `{"ok":true,...}` regardless of whether the GitHub-dependent
work inside them (the account read, the OAuth exchange) succeeds — without
`GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` or
`GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET` configured, expect
`recorded: false` / `signedIn: false` with a `reason` naming the missing
credentials, not a thrown error — see `src/server/env.ts`.
