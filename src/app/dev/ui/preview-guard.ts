// Task 10.2 (design.md Decision 9): the guard every page under src/app/dev/ui/
// calls as its first statement. When previews are disabled
// (`uiPreviewEnabled` false — JUMPHOUR_UI_PREVIEW is not exactly "1") it calls
// Next's `notFound()`, so a disabled deployment answers exactly as it would
// for an address that does not exist — not a redirect, not a 403, nothing
// that confirms the preview route is there. When enabled it returns normally.
//
// `env` is injectable for tests; pages call `previewGuard()` with no argument
// so the flag is always read from the environment through getEnv().
import { notFound } from "next/navigation";
import { getEnv, type Env } from "../../../server/env";

export function previewGuard(env: Pick<Env, "uiPreviewEnabled"> = getEnv()): void {
  if (!env.uiPreviewEnabled) {
    notFound();
  }
}
