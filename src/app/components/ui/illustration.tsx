// Task 5.5: a generic wrapper for decorative illustration art (an
// empty-state graphic, ornamental line art). specs/design-system/spec.md
// "Give every icon-only control an accessible name" names "illustration
// art" as decorative imagery that SHALL be hidden from assistive
// technology rather than announced; the information it decorates must stay
// available from adjacent text, which is the caller's responsibility — this
// wrapper only guarantees the art itself is never exposed to AT, regardless
// of what markup (an <img alt="…">, a <title>, nested text) the caller
// passes as children, because `aria-hidden="true"` removes the whole
// subtree from the accessibility tree.
import type { ReactNode } from "react";
import styles from "./illustration.module.css";

export interface IllustrationProps {
  children: ReactNode;
  className?: string;
}

export function Illustration({ children, className }: IllustrationProps) {
  const classes = [styles.illustration, className].filter(Boolean).join(" ");
  return (
    <div aria-hidden="true" className={classes}>
      {children}
    </div>
  );
}
