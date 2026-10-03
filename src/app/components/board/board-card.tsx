// Task 3.1 (specs/workflow-board/spec.md "Present cards with a consistent,
// evidence-first anatomy"; design.md Decision 5): one card on the board.
//
// Markup is article + heading + stretched button. The `<h3>` holds a
// `<button aria-pressed>` whose only content is the title, so the heading
// survives and the accessible name is the title rather than every string on
// the card; the button's `::after` covers the article so the whole card is
// the hit target. The badge/key row describes the button via
// `aria-describedby`.
//
// Order: badge + key + freshness, title, context row (repository, owner,
// relevance), evidence (after a decorative tone dot), agent note (italic),
// footer (+ external-host label with a decorative ↗; a label, never a link). Every
// optional value is omitted when absent — no "Unassigned", no placeholder key.
//
// Task 3.2: every card string is rendered as a React text node, so markup in
// provider data is shown literally, never parsed. The title is clamped to
// three lines in CSS only; the button's text, and so its accessible name, is
// always the full title.
import { useId } from "react";
import type { CardViewModel } from "../../../lib/board/board-view-model";
import { sourcePresentation } from "../../../lib/board/source-presentation";
import { formatRelativeTime } from "../../../lib/time/format-relative-time";
import { ExternalLinkIcon } from "../ui/icon";
import { SourceBadge } from "../ui/source-badge";
import { ToneDot } from "../ui/tone-dot";
import { OwnerAvatar } from "./owner-avatar";
import styles from "./board-card.module.css";

const FRESHNESS_LABEL: Readonly<Record<CardViewModel["freshness"]["kind"], string>> = {
  snapshot: "Snapshot",
  fetched: "Fetched",
  composed: "Composed",
};

/** "Snapshot 14 min ago", measured against the board's `generatedAt`. */
export function formatFreshness(freshness: CardViewModel["freshness"], generatedAt: string): string {
  return `${FRESHNESS_LABEL[freshness.kind]} ${formatRelativeTime(freshness.at, generatedAt)}`;
}

export interface BoardCardProps {
  card: CardViewModel;
  /** `BoardViewModel.generatedAt`; the freshness line is measured against it. */
  generatedAt: string;
  selected: boolean;
  /** Called with the card's id when the card is activated. */
  onSelect?: (cardId: string) => void;
}

export function BoardCard({ card, generatedAt, selected, onSelect }: BoardCardProps) {
  const metaId = useId();
  const presentation = sourcePresentation(card.source.kind);
  const hasContext = card.repository !== null || card.owner !== null || card.relevance !== null;

  return (
    <article
      className={[styles.card, selected ? styles.selected : null].filter(Boolean).join(" ")}
      data-card-id={card.id}
      data-lane-id={card.laneId}
    >
      <div className={styles.meta} id={metaId}>
        <SourceBadge source={presentation.badgeVariant} />
        {card.source.key !== null ? <span className={styles.key}>{card.source.key}</span> : null}
        <span className={styles.freshness}>{formatFreshness(card.freshness, generatedAt)}</span>
      </div>

      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.select}
          aria-pressed={selected}
          aria-describedby={metaId}
          onClick={onSelect ? () => onSelect(card.id) : undefined}
        >
          {card.title}
        </button>
      </h3>

      {hasContext ? (
        <div className={styles.context}>
          {card.repository !== null ? (
            <span className={styles.repository}>{card.repository.fullName}</span>
          ) : null}
          {card.owner !== null ? (
            <span className={styles.owner}>
              <OwnerAvatar owner={card.owner} />
              <span>{card.owner.displayName}</span>
            </span>
          ) : null}
          {card.relevance !== null ? <span className={styles.relevance}>{card.relevance}</span> : null}
        </div>
      ) : null}

      {/* The evidence text states why the card is in its lane. The tone dot
          is decorative (aria-hidden) and the tone is also exposed as data, so
          no state is carried by color alone. */}
      <p className={styles.evidence} data-evidence-tone={card.evidence.tone}>
        <ToneDot tone={card.evidence.tone} className={styles.evidenceDot} />
        <span>{card.evidence.text}</span>
      </p>

      {card.agentNote !== null ? <p className={styles.agentNote}>{card.agentNote}</p> : null}

      <p className={styles.footer}>
        <span>{card.footer}</span>
        {card.externalHostLabel !== null ? (
          <span className={styles.host} data-external-host="">
            {card.externalHostLabel}
            <ExternalLinkIcon size={10} />
          </span>
        ) : null}
      </p>
    </article>
  );
}
