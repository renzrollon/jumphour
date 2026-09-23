// Appearance preferences (theme + cats), read from and written to two cookies.
// Framework-free by design: no react, no next/*, no src/server import.

export const THEME_COOKIE = "jumphour_theme";
export const CATS_COOKIE = "jumphour_cats";

export type Theme = "system" | "light" | "dark";
export type Cats = "on" | "off";

export interface Appearance {
  theme: Theme;
  cats: Cats;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "light", cats: "off" };

const THEMES: readonly Theme[] = ["system", "light", "dark"];
const CATS: readonly Cats[] = ["on", "off"];

/** Raw cookie values as read from the request; absent cookies are undefined or null. */
export interface AppearanceCookies {
  theme?: string | null;
  cats?: string | null;
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isCats(value: unknown): value is Cats {
  return typeof value === "string" && (CATS as readonly string[]).includes(value);
}

/**
 * Parse the two appearance cookie values by exact string equality against the
 * canonical tokens. No trimming, no case folding, no aliasing: anything else is
 * treated as absent and yields that field's default. The fields fall back
 * independently.
 */
export function parseAppearance(cookies: AppearanceCookies = {}): Appearance {
  return {
    theme: isTheme(cookies.theme) ? cookies.theme : DEFAULT_APPEARANCE.theme,
    cats: isCats(cookies.cats) ? cookies.cats : DEFAULT_APPEARANCE.cats,
  };
}

/** One year, in seconds. */
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * A cookie write for one appearance field. The shape matches the options a
 * cookie store's `set` accepts, and `serializeAppearanceCookie` turns it into a
 * `Set-Cookie` header value. Not httpOnly: the value is no secret and a later
 * client control may read it.
 */
export interface AppearanceCookie {
  name: typeof THEME_COOKIE | typeof CATS_COOKIE;
  value: Theme | Cats;
  path: "/";
  sameSite: "lax";
  maxAge: number;
  httpOnly: false;
}

function cookieFor(name: AppearanceCookie["name"], value: Theme | Cats): AppearanceCookie {
  return { name, value, path: "/", sameSite: "lax", maxAge: APPEARANCE_COOKIE_MAX_AGE, httpOnly: false };
}

/** Build the theme cookie write. Throws on anything but a canonical theme token. */
export function themeCookie(theme: Theme): AppearanceCookie {
  if (!isTheme(theme)) throw new Error("Refusing to write a non-canonical theme value");
  return cookieFor(THEME_COOKIE, theme);
}

/** Build the cats cookie write. Throws on anything but a canonical cats token. */
export function catsCookie(cats: Cats): AppearanceCookie {
  if (!isCats(cats)) throw new Error("Refusing to write a non-canonical cats value");
  return cookieFor(CATS_COOKIE, cats);
}

/**
 * Serialize a cookie write into a `Set-Cookie` header value. The name/value pair
 * is re-checked here, so a hand-built or mutated object carrying a non-canonical
 * value can never reach the header.
 */
export function serializeAppearanceCookie(cookie: AppearanceCookie): string {
  const canonical =
    cookie.name === THEME_COOKIE ? themeCookie(cookie.value as Theme) :
    cookie.name === CATS_COOKIE ? catsCookie(cookie.value as Cats) :
    undefined;
  if (!canonical) throw new Error("Refusing to write an unknown appearance cookie");
  return `${canonical.name}=${canonical.value}; Path=/; Max-Age=${APPEARANCE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
