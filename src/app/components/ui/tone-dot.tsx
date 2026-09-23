// Task 5.5: a small dot naming a tone visually. Per
// specs/design-system/spec.md "Never convey state by color alone", the dot
// is never the only carrier of meaning — Badge and Banner always pair it
// with a required text label, and the dot itself is purely decorative: the
// same spec's "Give every icon-only control an accessible name" requirement
// names "tone dots" explicitly as imagery that SHALL be hidden from
// assistive technology rather than announced.
import styles from "./tone-dot.module.css";

// Shared with design.md's binding view-model vocabulary (the handoff brief's
// `Tone` type, owned by change 2's src/lib/board/*). Defined locally here
// because change 2's files do not exist yet; a later change importing this
// value set keeps one definition rather than a second copy.
export type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";

export interface ToneDotProps {
  tone: Tone;
  className?: string;
}

export function ToneDot({ tone, className }: ToneDotProps) {
  const classes = [styles.dot, styles[tone], className].filter(Boolean).join(" ");
  return <span aria-hidden="true" className={classes} />;
}
