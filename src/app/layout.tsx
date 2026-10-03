// next-env.d.ts is generated and gitignored; reference Next's ambient types
// (including the `*.css` module declaration) so typecheck passes in a clean checkout.
/// <reference types="next" />
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./tokens.css";
import "./globals.css";
import { fontVariableClasses } from "./fonts";
import { CATS_COOKIE, THEME_COOKIE, parseAppearance } from "../lib/appearance/appearance";

export const metadata = {
  title: "Jumphour",
};

// Task 4.1 (design.md Decision 3): the appearance cookies are read here, on the
// server, before the first byte. `data-jh-theme` is stamped only for an explicit
// light/dark choice; `system` stamps nothing so tokens.css resolves it through
// prefers-color-scheme alone. `data-jh-cats` is stamped only when cats is on.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const { theme, cats } = parseAppearance({
    theme: store.get(THEME_COOKIE)?.value,
    cats: store.get(CATS_COOKIE)?.value,
  });

  return (
    <html
      lang="en"
      className={fontVariableClasses}
      data-jh-theme={theme === "system" ? undefined : theme}
      data-jh-cats={cats === "on" ? "on" : undefined}
    >
      <body>{children}</body>
    </html>
  );
}
