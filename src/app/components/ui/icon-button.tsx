// Task 5.5: the icon-only control primitive.
// specs/design-system/spec.md "Give every icon-only control an accessible
// name" requires an accessible name that states the control's purpose on
// every control whose visible content is only an icon — so `aria-label` is
// a REQUIRED prop here, not optional: omitting it is a compile error, not a
// runtime possibility (see icon-button.test.tsx's `@ts-expect-error`
// check, which `npm run typecheck` enforces). `children` is deliberately
// not accepted — an IconButton's visible content is only ever its icon,
// which is itself wrapped and hidden from assistive technology, so the
// button's `aria-label` is the only name a screen reader ever announces.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./icon-button.module.css";

export type IconButtonVariant = "outline" | "ghost";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "aria-label"> {
  icon: ReactNode;
  /** REQUIRED. States what the control does, e.g. "Settings", "Dismiss". */
  "aria-label": string;
  variant?: IconButtonVariant;
  type?: "button" | "submit" | "reset";
}

export function IconButton({
  icon,
  "aria-label": ariaLabel,
  variant = "outline",
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  return (
    <button type={type} aria-label={ariaLabel} className={classes} {...rest}>
      <span aria-hidden="true" className={styles.icon}>
        {icon}
      </span>
    </button>
  );
}
