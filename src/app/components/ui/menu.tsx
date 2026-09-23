"use client";

// Task 5.3 (design.md Decision 4): an action menu on the shared overlay core
// as a `transient` surface. The core supplies Escape (innermost-first, so a
// menu inside a dialog closes alone), outside-press dismissal that activates
// nothing, one-transient-at-a-time, and focus return to the trigger. This
// module adds the menu keyboard model: Up/Down move focus between enabled
// items with wrapping, Home/End jump to the ends, Enter or Space activate the
// focused item and close the menu, Tab closes it. ArrowDown/ArrowUp on the
// trigger open it on the first/last item. Items are never tab stops
// (tabIndex -1); focus is moved programmatically.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useOverlay } from "./overlay";
import { useTransientOpen, type TransientStateProps, type TriggerProps } from "./transient";
import styles from "./transient.module.css";

export type { TriggerProps } from "./transient";

export interface MenuItem {
  /** Stable key for the item. */
  id: string;
  label: ReactNode;
  /** Secondary line under the label, e.g. "Local view only. Source is not changed." */
  description?: ReactNode;
  onSelect: () => void;
  /** Shown but skipped by the arrow keys and never activated. */
  disabled?: boolean;
}

export interface MenuProps extends TransientStateProps {
  /** Accessible name of the menu, e.g. "Load ideas from". */
  label: string;
  renderTrigger: (props: TriggerProps) => ReactNode;
  items: readonly MenuItem[];
  /** Which trigger edge the menu lines up with. Default "end". */
  align?: "start" | "end";
  className?: string;
}

type Landing = "first" | "last";

function enabledIndexes(items: readonly MenuItem[]): number[] {
  return items.flatMap((item, index) => (item.disabled ? [] : [index]));
}

export function Menu({ label, renderTrigger, items, align = "end", className, ...state }: MenuProps) {
  const [open, setOpen] = useTransientOpen(state);
  const [landing, setLanding] = useState<Landing>("first");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const id = useId();

  const enabled = enabledIndexes(items);
  const landingIndex = landing === "first" ? enabled[0] : enabled[enabled.length - 1];

  useOverlay({
    open,
    kind: "transient",
    surfaceRef,
    invokerRef: triggerRef,
    initialFocusRef,
    onDismiss: () => setOpen(false),
  });

  const openAt = (where: Landing) => {
    setLanding(where);
    setOpen(true);
  };

  const trigger: TriggerProps = {
    ref: triggerRef,
    type: "button",
    "aria-expanded": open,
    "aria-haspopup": "menu",
    "aria-controls": open ? id : undefined,
    onClick: () => {
      if (open) setOpen(false);
      else openAt("first");
    },
    onKeyDown: (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      openAt(event.key === "ArrowDown" ? "first" : "last");
    },
  };

  const focusItem = (index: number | undefined) => {
    if (index !== undefined) itemRefs.current[index]?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const current = itemRefs.current.findIndex((el) => el !== null && el === event.target);
    const at = enabled.indexOf(current);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(enabled[at < 0 ? 0 : (at + 1) % enabled.length]);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(enabled[at < 0 ? enabled.length - 1 : (at - 1 + enabled.length) % enabled.length]);
        break;
      case "Home":
        event.preventDefault();
        focusItem(enabled[0]);
        break;
      case "End":
        event.preventDefault();
        focusItem(enabled[enabled.length - 1]);
        break;
      case "Tab":
        // Leaving the menu closes it; focus returns to the trigger, then Tab moves on from there.
        setOpen(false);
        break;
    }
  };

  const activate = (item: MenuItem) => {
    if (item.disabled) return;
    item.onSelect();
    setOpen(false);
  };

  const surfaceClasses = [styles.surface, styles.menu, align === "end" ? styles.end : styles.start, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.anchor}>
      {renderTrigger(trigger)}
      {open ? (
        <div
          ref={surfaceRef}
          id={id}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          className={surfaceClasses}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
                if (index === landingIndex) initialFocusRef.current = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              className={styles.item}
              onClick={() => activate(item)}
            >
              <span className={styles.itemLabel}>{item.label}</span>
              {item.description ? <span className={styles.itemDescription}>{item.description}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
