// Task 5.5: the primary text-button primitive. Visible label text is
// required (`children`) — an icon-only control uses IconButton instead,
// whose type enforces an accessible name
// (specs/design-system/spec.md "Give every icon-only control an accessible
// name"). Defaults `type="button"` so a Button dropped inside a <form> (as
// the sign-out or theme-preference forms will) never submits by accident.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  children: ReactNode;
}

export function Button({ variant = "secondary", type = "button", className, children, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
