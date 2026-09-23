import { NextRequest, NextResponse } from "next/server";
import { getDriver } from "../../../../server/db";
import { deleteSession } from "../../../../server/db/sessions";

const SESSION_COOKIE = "jumphour_session";

// Local-only sign-out (design.md Decision 7). A POST from the account menu's
// plain form deletes the session row, expires the session cookie, and 303s to
// the signed-out view at /. It makes no GitHub request: the user's OAuth
// authorization and the App installation are untouched, so signing in again is
// immediate. POST, not GET, so a prefetch or crawler cannot end a session.
//
// Idempotent: a missing cookie, or one naming a session that no longer exists,
// takes the same path and gets the same response. deleteSession returning
// false means "already signed out", never an error. The appearance cookies are
// not touched, so the theme and cats choices survive sign-out.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessionId = new NextRequest(request).cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    deleteSession(getDriver(), sessionId);
  }

  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  // Same attributes the callback sets, so the browser matches and drops it.
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
