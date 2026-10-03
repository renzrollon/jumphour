// Task 10.3 (design.md Decision 9; specs/app-shell/spec.md "Keep the
// interface preview surfaces unreachable unless explicitly enabled"): the
// /dev/ui index. `previewGuard()` runs as the very first statement — before
// the cookie read below, before anything else — so a disabled deployment
// answers not-found before this page does any other work, matching task
// 10.4's enumeration test ("every page under src/app/dev/ui/ calls the guard
// as its first statement").
//
// This is the "primitives-and-shell index" design.md Decision 9 promises in
// place of Storybook (Decision 4's "Rejected" list: "a large dependency tree
// and a second rendering environment for what one guarded route provides").
// ./primitives-gallery.tsx exhibits every primitive from design.md Decision
// 11's list; this file supplies the shell (AppShell/TopAppBar) around it, so
// a developer sees primitives and the composed shell in one place. "Both
// presentations" (task 10.3) come from the real theme control the shell
// already carries — this page reads the same server-side appearance cookie
// every other page does (design.md invariant sweep, "Appearance preference"
// row: "preview gallery" is a listed reader of the canonical parsed value)
// and passes it to `AppShell` exactly like `src/app/page.tsx` does, so
// switching System/Light/Dark here is the real control, not a preview-only
// copy.
//
// The workspace and account labels are fixture data (./fixtures/shell.ts):
// "Platform delivery" and "Priya Nair" are the Claude Design prototype's
// sample names (design.md Decision 8), never a stored row — this route never
// reads the database. The persistent "Preview — fixture data" label
// (./primitives-gallery.tsx) is always rendered, so nobody mistakes this
// index for a real installation or account.
import { cookies } from "next/headers";
import { previewGuard } from "./preview-guard";
import { CATS_COOKIE, THEME_COOKIE, parseAppearance } from "../../../lib/appearance/appearance";
import { AppShell } from "../../components/shell/app-shell";
import { PrimitivesGallery } from "./primitives-gallery";
import { PREVIEW_ACCOUNT, PREVIEW_WORKSPACE } from "./fixtures/shell";

export default async function DevUiIndexPage() {
  previewGuard();

  const cookieStore = await cookies();
  const appearance = parseAppearance({
    theme: cookieStore.get(THEME_COOKIE)?.value,
    cats: cookieStore.get(CATS_COOKIE)?.value,
  });

  return (
    <AppShell workspace={PREVIEW_WORKSPACE} account={PREVIEW_ACCOUNT} appearance={appearance}>
      <PrimitivesGallery />
    </AppShell>
  );
}
