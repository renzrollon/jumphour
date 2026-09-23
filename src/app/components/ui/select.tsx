// Task 5.5: a labelled native <select>. A native select already has
// correct keyboard behavior and platform affordances, so this wraps rather
// than reimplements one. specs/design-system/spec.md's arrow-key
// radiogroup requirement targets SegmentedControl (task 5.4), not this
// element — a <select> is not a radiogroup.
import { useId, type ChangeEvent, type SelectHTMLAttributes } from "react";
import styles from "./select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children" | "onChange"> {
  label: string;
  hideLabel?: boolean;
  options: readonly SelectOption[];
  id?: string;
  onChange?: (value: string, event: ChangeEvent<HTMLSelectElement>) => void;
}

export function Select({ label, hideLabel, options, id, className, onChange, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={selectId} className={hideLabel ? styles.visuallyHidden : styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        onChange={(event) => onChange?.(event.target.value, event)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
