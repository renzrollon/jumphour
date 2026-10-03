"use client";

// Task 5.3 (design.md Decision 4): a transient, non-modal surface anchored to
// its trigger — e.g. the board's lifecycle legend. Behavior comes from the
// shared overlay core as a `transient` surface: Escape closes it and returns
// focus to the trigger, a press outside closes it without activating anything
// inside, and opening another transient surface closes it. The trigger is
// rendered by the caller through `renderTrigger`, which receives the props
// (aria-expanded, aria-haspopup, aria-controls, ref, onClick) to spread onto
// a `<button>`.
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { useOverlay } from "./overlay";
import { useTransientOpen, type TransientStateProps, type TriggerProps } from "./transient";
import styles from "./transient.module.css";

export type { TriggerProps } from "./transient";

export interface PopoverProps extends TransientStateProps {
  /** Accessible name of the popover surface. */
  label: string;
  renderTrigger: (props: TriggerProps) => ReactNode;
  children: ReactNode;
  /** Which trigger edge the surface lines up with. Default "start". */
  align?: "start" | "end";
  /** Where focus lands on open. Defaults to the first tabbable element, then the surface. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

export function Popover({
  label,
  renderTrigger,
  children,
  align = "start",
  initialFocusRef,
  className,
  ...state
}: PopoverProps) {
  const [open, setOpen] = useTransientOpen(state);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useOverlay({
    open,
    kind: "transient",
    surfaceRef,
    invokerRef: triggerRef,
    initialFocusRef,
    onDismiss: () => setOpen(false),
  });

  const trigger: TriggerProps = {
    ref: triggerRef,
    type: "button",
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    "aria-controls": open ? id : undefined,
    onClick: () => setOpen(!open),
  };

  const surfaceClasses = [styles.surface, styles.popover, align === "end" ? styles.end : styles.start, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.anchor}>
      {renderTrigger(trigger)}
      {open ? (
        <div ref={surfaceRef} id={id} role="dialog" aria-label={label} tabIndex={-1} className={surfaceClasses}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
