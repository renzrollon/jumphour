// Task 5.5: a boolean on/off control exposed as role="switch" (the WAI-ARIA
// switch pattern), matching the prototype's cats toggle (a button with
// role="switch", aria-checked, and onClick). The track/knob visual is
// decorative (aria-hidden); the accessible name comes from the button's own
// text content, so a caller passes its visible label as `children`. This is
// not an icon-only control, so IconButton's required-`aria-label` rule does
// not apply here — but a name is still mandatory, so `children` is required.
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import styles from "./switch.module.css";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "role" | "onChange" | "children"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

export function Switch({ checked, onChange, children, className, onClick, ...rest }: SwitchProps) {
  const classes = [styles.switch, className].filter(Boolean).join(" ");
  const trackClasses = [styles.track, checked ? styles.on : ""].filter(Boolean).join(" ");

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    onChange(!checked);
  }

  return (
    <button type="button" role="switch" aria-checked={checked} className={classes} onClick={handleClick} {...rest}>
      <span aria-hidden="true" className={trackClasses}>
        <span aria-hidden="true" className={styles.knob} />
      </span>
      <span className={styles.label}>{children}</span>
    </button>
  );
}
