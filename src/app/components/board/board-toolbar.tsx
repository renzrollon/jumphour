// Task 4.1 (specs/workflow-board/spec.md "Filter the board by repository,
// source, and owner"; design.md Decision 4, "Repository identity", "Source
// presentation", "Owner key"): the toolbar's three filters.
//
// - Repository options come from `view.repositories`, one per `githubRepoId`
//   and labelled with its `fullName`; the value carried is the id, never the
//   name, so a renamed repository is one option.
// - Source options are "All sources" and the four source kinds, labelled by
//   `sourcePresentation`.
// - Owner options are the distinct `ownerKey`s present on the board's cards
//   plus "No owner". When no card has an owner the owner filter is not
//   rendered at all.
//
// The toolbar holds no state: it shows `filters` and reports each change as a
// whole next `BoardFilters`. Other toolbar controls (legend, Load ideas,
// Compose idea) are passed in as children and sit after the filters.
import type { ReactNode } from "react";
import type { CardViewModel, RepositoryRef, SourceKind } from "../../../lib/board/board-view-model";
import { NO_OWNER_KEY, ownerKey, type BoardFilters } from "../../../lib/board/filter-cards";
import { sourcePresentation } from "../../../lib/board/source-presentation";
import { Select, type SelectOption } from "../ui/select";
import styles from "./board-toolbar.module.css";

/** The `<select>` value that means "no filter" in every filter. No repository id, source kind, or owner key is empty. */
const ALL = "";

/** Source kinds in source-filter order. */
const SOURCE_FILTER_KINDS = ["github-issue", "gitlab-issue", "jira", "manual"] as const satisfies readonly SourceKind[];
type MissingSourceKind = Exclude<SourceKind, (typeof SOURCE_FILTER_KINDS)[number]>;
const everySourceListed: [MissingSourceKind] extends [never] ? true : never = true;
void everySourceListed;

/** "All repositories", then one option per `githubRepoId` (first `fullName` seen), valued by the id. */
export function repositoryFilterOptions(repositories: readonly RepositoryRef[]): SelectOption[] {
  const seen = new Set<number>();
  const options: SelectOption[] = [{ value: ALL, label: "All repositories" }];
  for (const repository of repositories) {
    if (seen.has(repository.githubRepoId)) continue;
    seen.add(repository.githubRepoId);
    options.push({ value: String(repository.githubRepoId), label: repository.fullName });
  }
  return options;
}

export function sourceFilterOptions(): SelectOption[] {
  return [
    { value: ALL, label: "All sources" },
    ...SOURCE_FILTER_KINDS.map((kind) => ({ value: kind, label: sourcePresentation(kind).label })),
  ];
}

/**
 * "Any owner", the distinct owner keys on `cards` in name order, then "No
 * owner" — or `null` when no card has an owner, meaning the filter is not shown.
 */
export function ownerFilterOptions(cards: readonly CardViewModel[]): SelectOption[] | null {
  const owners = new Set(cards.map((card) => ownerKey(card.owner)));
  owners.delete(NO_OWNER_KEY);
  if (owners.size === 0) return null;
  const named = [...owners].sort((a, b) => a.localeCompare(b));
  return [
    { value: ALL, label: "Any owner" },
    ...named.map((key) => ({ value: key, label: key })),
    { value: NO_OWNER_KEY, label: NO_OWNER_KEY },
  ];
}

function parseSource(value: string): SourceKind | null {
  return (SOURCE_FILTER_KINDS as readonly string[]).includes(value) ? (value as SourceKind) : null;
}

function parseRepositoryId(value: string): number | null {
  if (value === ALL) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export interface BoardToolbarProps {
  /** `BoardViewModel.repositories`. */
  repositories: readonly RepositoryRef[];
  /** Every card on the board, before filtering; owner options derive from these. */
  cards: readonly CardViewModel[];
  filters: BoardFilters;
  onFiltersChange: (next: BoardFilters) => void;
  /** Legend, Load ideas, Compose idea — rendered after the filters. */
  children?: ReactNode;
}

export function BoardToolbar({ repositories, cards, filters, onFiltersChange, children }: BoardToolbarProps) {
  const owners = ownerFilterOptions(cards);

  return (
    <div className={styles.toolbar}>
      <Select
        className={styles.filter}
        label="Repository scope"
        hideLabel
        options={repositoryFilterOptions(repositories)}
        value={filters.repositoryId === null ? ALL : String(filters.repositoryId)}
        onChange={(value) => onFiltersChange({ ...filters, repositoryId: parseRepositoryId(value) })}
      />
      <Select
        className={styles.filter}
        label="Source filter"
        hideLabel
        options={sourceFilterOptions()}
        value={filters.source ?? ALL}
        onChange={(value) => onFiltersChange({ ...filters, source: parseSource(value) })}
      />
      {owners ? (
        <Select
          className={styles.filter}
          label="Owner filter"
          hideLabel
          options={owners}
          value={filters.owner ?? ALL}
          onChange={(value) => onFiltersChange({ ...filters, owner: value === ALL ? null : value })}
        />
      ) : null}
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
