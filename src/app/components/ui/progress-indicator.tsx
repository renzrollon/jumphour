// Task 5.7: the in-progress indicator — a spinner paired with visible text in
// a `role="status"` region, so the work in progress is stated in words and
// announced, never carried by motion alone. Under reduced motion the spinner
// is shown as a static ring (progress-indicator.module.css, backed by
// globals.css) and the text is unchanged (specs/design-system/spec.md
// "Honor the viewer's reduced-motion setting").
import { SpinnerIcon } from "./icon";
import styles from "./progress-indicator.module.css";

export interface ProgressIndicatorProps {
  /** States the work in progress, e.g. "Checking repository access…". Always shown. */
  label: string;
  className?: string;
}

export function ProgressIndicator({ label, className }: ProgressIndicatorProps) {
  const classes = [styles.indicator, className].filter(Boolean).join(" ");
  return (
    <span role="status" aria-busy="true" className={classes}>
      <span aria-hidden="true" className={styles.spinner}>
        <SpinnerIcon size={12} />
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
