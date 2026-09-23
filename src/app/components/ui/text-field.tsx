// Task 5.5: a labelled single-line input. The label is always present in
// the accessibility tree — `hideLabel` only hides it visually — so this
// never falls back to an `aria-label` that duplicates visible text. An
// `error`, when present, renders as a `role="alert"` wired to the input by
// `aria-describedby` (matching the prototype's compose-form error pattern,
// e.g. `id="title-err" role="alert"`).
import { useId, type InputHTMLAttributes } from "react";
import styles from "./text-field.module.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  id?: string;
}

export function TextField({ label, hideLabel, error, id, className, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={hideLabel ? styles.visuallyHidden : styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...rest}
      />
      {error ? (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
