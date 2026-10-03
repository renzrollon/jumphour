// Board filtering (design.md Decision 4: "Search query", "Card search text",
// "Owner key", "Repository identity"). Query and card text go through the same
// `normalizeQuery`, so casing, whitespace, and Unicode compatibility forms
// cannot diverge between the two sides of the comparison. Repository filtering
// compares `githubRepoId`, never `fullName`.
import type { CardViewModel, SourceKind } from "./board-view-model";

/** `null` in any field means "no filter" (All repositories / sources / owners). */
export interface BoardFilters {
  query: string;
  repositoryId: number | null;
  source: SourceKind | null;
  /** An `ownerKey` value. */
  owner: string | null;
}

export const NO_FILTERS: Readonly<BoardFilters> = { query: "", repositoryId: null, source: null, owner: null };

export const NO_OWNER_KEY = "No owner";

/** NFKC → trim → collapse internal whitespace → lowercase. `""` means "no query". */
export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** `displayName` after NFC + trim; "No owner" for a null (or blank) owner. */
export function ownerKey(owner: CardViewModel["owner"]): string {
  const key = owner?.displayName.normalize("NFC").trim() ?? "";
  return key === "" ? NO_OWNER_KEY : key;
}

/** True when any filter narrows the board; a whitespace-only query does not. */
export function filtersActive(filters: BoardFilters): boolean {
  return (
    normalizeQuery(filters.query) !== "" ||
    filters.repositoryId !== null ||
    filters.source !== null ||
    filters.owner !== null
  );
}

/**
 * Title, source key, change name, and evidence text, each normalized and
 * joined by a newline. A normalized query never contains a newline, so a
 * match cannot straddle two fields.
 */
export function cardSearchText(card: CardViewModel): string {
  return [card.title, card.source.key, card.changeName, card.evidence.text]
    .filter((part): part is string => part !== null)
    .map(normalizeQuery)
    .join("\n");
}

/** The card predicate: every active filter must hold (AND). */
export function cardMatchesFilters(card: CardViewModel, filters: BoardFilters): boolean {
  if (filters.repositoryId !== null && card.repository !== null && card.repository.githubRepoId !== filters.repositoryId) {
    return false;
  }
  if (filters.source !== null && card.source.kind !== filters.source) return false;
  if (filters.owner !== null && ownerKey(card.owner) !== filters.owner) return false;
  const query = normalizeQuery(filters.query);
  return query === "" || cardSearchText(card).includes(query);
}
