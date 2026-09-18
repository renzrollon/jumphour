// Task 8.4: Refresh must "re-run listing and discovery for the current
// installation". Listing is `GET /user/installations/{id}/repositories`,
// which design.md Decision 2 binds to the signed-in user's own
// user-to-server token — and design.md Decision 7 names no token-storage
// table, so no request after the OAuth callback holds one. A Refresh click
// therefore cannot call the listing API directly; it has to acquire a fresh
// user token first, which means a round trip through GitHub's OAuth
// authorize endpoint and back into ../../app/api/github/oauth/callback.
//
// That round trip loses two things unless they are carried across it:
//
//   1. WHY the user is at the callback. A plain sign-in callback answers
//      with JSON; a refresh must land the browser back on the signed-in
//      surface instead.
//   2. WHICH installation was current. `completeOAuthSignIn` (task 3.4)
//      always inserts a NEW session row with `installation_id` NULL, so the
//      installation the user was looking at when they clicked Refresh is
//      gone by the time the callback runs.
//
// GitHub echoes exactly one caller-controlled value back on the callback —
// the `state` parameter — so both travel in it, encoded here rather than
// parsed ad hoc at either end.
//
// KNOWN GAP, deliberately not papered over: `state` is also OAuth's
// anti-CSRF slot, and this codebase does not yet issue or verify a nonce
// there (../../app/api/github/oauth/callback/route.ts reads `state` and
// echoes it without validation — it did so before this task). Encoding a
// return intent in `state` does not create that gap, but it does occupy the
// field, so the nonce must be added as an ADDITIONAL component here rather
// than by replacing this value. `decodeRefreshState` already tolerates
// unknown extra segments for that reason.

const REFRESH_PREFIX = "refresh";
const SEPARATOR = ":";

export interface RefreshReturnState {
  intent: "refresh";
  /** The installation that was current when Refresh was clicked. */
  installationId: number;
}

/**
 * Encodes "this OAuth round trip is a Refresh for installation N" into the
 * `state` value handed to GitHub's authorize endpoint.
 */
export function encodeRefreshState(installationId: number): string {
  return `${REFRESH_PREFIX}${SEPARATOR}${installationId}`;
}

/**
 * Decodes a `state` value received on the OAuth callback, returning null for
 * anything that is not a well-formed refresh marker — an ordinary sign-in
 * (no state at all), a malformed value, or a non-numeric installation id.
 * Null means "treat this as a normal sign-in", which is the safe default:
 * the worst case is a JSON sign-in response instead of a redirect, never a
 * refresh performed against an installation that was not actually named.
 */
export function decodeRefreshState(state: string | null | undefined): RefreshReturnState | null {
  if (!state) return null;

  const segments = state.split(SEPARATOR);
  if (segments[0] !== REFRESH_PREFIX) return null;

  // Segment 1 is the installation id. Later segments (a future CSRF nonce)
  // are ignored here rather than rejected, so adding one does not break
  // this reader.
  const raw = segments[1];
  if (!raw || !/^\d+$/.test(raw)) return null;

  const installationId = Number(raw);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) return null;

  return { intent: "refresh", installationId };
}
