"use client";

// Task 5.4 (design.md Decision 4): a mutually exclusive option group rendered as
// a roving-tabindex radiogroup. The group is one tab stop: the checked option
// carries tabIndex 0 (the first option does when the current value matches no
// option), every other option carries -1. Arrow keys move both focus and the
// choice, wrapping at either end; Tab is left to the browser, so it leaves the
// group. The component is controlled: `value` comes from the caller and every
// choice is reported through `onChange`.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./segmented-control.module.css";

export interface SegmentedOption<V extends string> {
  value: V;
  /** Visible label. May differ from the accessible name (e.g. the cats layer). */
  label: ReactNode;
  /** Accessible name when the visible label is decorative or not plain text. */
  accessibleName?: string;
}

export type SegmentedControlProps<V extends string> = {
  options: readonly SegmentedOption<V>[];
  /** Current choice. A value matching no option leaves nothing checked. */
  value: string;
  onChange: (value: V) => void;
  className?: string;
} & ({ label: string; labelledBy?: never } | { labelledBy: string; label?: never });

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function SegmentedControl<V extends string>(props: SegmentedControlProps<V>) {
  const { options, value, onChange, className } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabStop = checkedIndex === -1 ? 0 : checkedIndex;

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    refs.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length;
    if (count === 0) return;
    let next: number;
    if (NEXT_KEYS.has(event.key)) next = (index + 1) % count;
    else if (PREV_KEYS.has(event.key)) next = (index - 1 + count) % count;
    else return;
    event.preventDefault();
    choose(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      aria-labelledby={props.labelledBy}
      className={className ? `${styles.group} ${className}` : styles.group}
    >
      {options.map((option, index) => {
        const checked = index === checkedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.accessibleName}
            tabIndex={index === tabStop ? 0 : -1}
            className={styles.option}
            onClick={() => choose(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
