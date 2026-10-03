// Task 3.3 (design.md "Owner avatars"): the owner's initials on one of four
// token pairs, chosen by a stable hash of the owner key so the same name always
// gets the same color in either theme. Decorative: the owner name is rendered
// as text beside it by the card.
import { ownerKey } from "../../../lib/board/filter-cards";
import styles from "./owner-avatar.module.css";

export const AVATAR_PAIRS = ["accent", "green", "amber", "jira"] as const;
export type AvatarPair = (typeof AVATAR_PAIRS)[number];

/** FNV-1a over UTF-16 code units of the owner key; stable across runs. */
export function avatarPair(key: string): AvatarPair {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length]!;
}

export function ownerInitials(key: string): string {
  const parts = key.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : parts.slice(0, 1);
  return letters.map((p) => Array.from(p)[0]!.toUpperCase()).join("");
}

export interface OwnerAvatarProps {
  owner: { displayName: string };
  className?: string;
}

export function OwnerAvatar({ owner, className }: OwnerAvatarProps) {
  const key = ownerKey(owner);
  const pair = avatarPair(key);
  const classes = [styles.avatar, styles[pair], className].filter(Boolean).join(" ");
  return (
    <span aria-hidden="true" className={classes} data-pair={pair}>
      {ownerInitials(key)}
    </span>
  );
}
