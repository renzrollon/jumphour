"use client";

// Task 5.3: state and trigger wiring shared by Popover and Menu. Internal —
// import Popover or Menu. The overlay core (overlay.ts) supplies Escape,
// outside-press dismissal, one-transient-at-a-time, and focus restoration;
// this module supplies the controlled/uncontrolled open state and the props
// that mark the invoking control expanded
// (specs/design-system/spec.md "Dismiss and navigate menus and popovers from
// the keyboard").
import { useCallback, useState, type KeyboardEvent, type MouseEvent, type RefObject } from "react";

/**
 * Spread onto the invoking `<button>`. `ref` is included so the core knows the
 * invoker even where clicking a button does not focus it (Safari).
 */
export interface TriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  type: "button";
  "aria-expanded": boolean;
  "aria-haspopup": "menu" | "dialog";
  "aria-controls": string | undefined;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export interface TransientStateProps {
  /** Controlled open state. Omit to let the component manage it. */
  open?: boolean;
  /** Initial open state when uncontrolled. Default false. */
  defaultOpen?: boolean;
  /** Called whenever the surface asks to open or close. */
  onOpenChange?: (open: boolean) => void;
}

export function useTransientOpen({ open, defaultOpen = false, onOpenChange }: TransientStateProps) {
  const [inner, setInner] = useState(defaultOpen);
  const controlled = open !== undefined;
  const value = controlled ? open : inner;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInner(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  return [value, setOpen] as const;
}
