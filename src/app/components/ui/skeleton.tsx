// Task 5.5: a loading placeholder. The shimmering block(s) are decorative
// (`aria-hidden` — specs/design-system/spec.md's decorative-imagery rule)
// and paired with a `role="status"`/`aria-busy` region carrying the
// required `label`, so the loading state is still announced to assistive
// technology when the shimmer itself is suppressed under reduced motion.
//
// Task 5.7: under `prefers-reduced-motion: reduce` the placeholder is static —
// the shimmer stops (skeleton.module.css, backed by globals.css) and the
// `label` text, otherwise visually hidden, is shown under the blocks, so a
// still placeholder reads as "loading" rather than as empty or finished
// (spec: "Honor the viewer's reduced-motion setting", Failure scenario).
//
// `labelVisible` shows the label above the blocks at every motion setting —
// the board's loading lanes name what they are reading, as the prototype does.
import styles from "./skeleton.module.css";

export interface SkeletonProps {
  /**
   * States what is loading, e.g. "Loading ideas". Always required — a
   * shimmering block with no accompanying text is exactly what the
   * "Never convey state by color alone" rule forbids for motion-only
   * signals.
   */
  label: string;
  /** Number of placeholder blocks to show. Default 1. */
  rows?: number;
  /** Show `label` above the blocks whatever the motion setting. Default false. */
  labelVisible?: boolean;
  className?: string;
}

export function Skeleton({ label, rows = 1, labelVisible = false, className }: SkeletonProps) {
  const classes = [styles.group, className].filter(Boolean).join(" ");
  return (
    <div role="status" aria-busy="true" aria-label={label} className={classes}>
      {labelVisible ? <span className={styles.visibleLabel}>{label}</span> : null}
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} aria-hidden="true" className={styles.block} />
      ))}
      {labelVisible ? null : <span className={styles.label}>{label}</span>}
    </div>
  );
}
