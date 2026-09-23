"use server";

// Task 8.4 (design.md Decision 3; specs/appearance-preferences/spec.md):
// the server actions behind the theme control and the cats toggle. Each
// accepts only a canonical token — the same exact-match rule
// `parseAppearance()` applies to the cookie — builds the write through the
// appearance module's cookie builder, passes it through
// `serializeAppearanceCookie()` (which refuses anything non-canonical), sets
// it, and revalidates the root layout. The re-render reads the new value from
// the same cookie store the layout reads, so the next paint already carries
// the new `data-jh-theme`/`data-jh-cats` and every control shows the same
// server-read value. No client code computes or applies a theme.
//
// A non-canonical input is refused without writing anything, so a tampered
// form post can neither store junk nor silently reset the choice.
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  catsCookie,
  parseAppearance,
  serializeAppearanceCookie,
  themeCookie,
  type AppearanceCookie,
  type Cats,
  type Theme,
} from "../../../lib/appearance/appearance";

async function write(cookie: AppearanceCookie): Promise<void> {
  serializeAppearanceCookie(cookie);
  const store = await cookies();
  store.set(cookie);
  revalidatePath("/", "layout");
}

function isCanonicalTheme(value: unknown): value is Theme {
  return typeof value === "string" && parseAppearance({ theme: value, cats: null }).theme === value;
}

function isCanonicalCats(value: unknown): value is Cats {
  return typeof value === "string" && parseAppearance({ theme: null, cats: value }).cats === value;
}

export async function setThemePreference(theme: string): Promise<void> {
  if (!isCanonicalTheme(theme)) return;
  await write(themeCookie(theme));
}

export async function setCatsPreference(cats: string): Promise<void> {
  if (!isCanonicalCats(cats)) return;
  await write(catsCookie(cats));
}
