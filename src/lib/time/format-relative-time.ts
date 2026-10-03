// Canonical relative time (design.md Decision 4). Every board duration goes
// through this one function, always measured against the board's
// `generatedAt`. Future instants clamp to "just now", and an unparseable
// instant is treated as zero elapsed, so the result is never a negative or
// future duration.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Formats the time elapsed from `iso` to `now` as "just now", "N min ago",
 * "N h ago", or "N d ago" (each unit floored).
 */
export function formatRelativeTime(iso: string, now: string | Date): string {
  const then = Date.parse(iso);
  const reference = typeof now === "string" ? Date.parse(now) : now.getTime();
  const raw = reference - then;
  const elapsed = Number.isFinite(raw) && raw > 0 ? raw : 0;

  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  return `${Math.floor(elapsed / DAY_MS)} d ago`;
}
