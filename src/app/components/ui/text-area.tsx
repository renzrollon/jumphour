// Task 5.5: a labelled multi-line input. Same labelling and error-wiring
// contract as TextField. `resize: vertical` and a default of 3 rows match
// the prototype's compose-form textareas (e.g. the problem/opportunity
// field).
import { useId, type TextareaHTMLAttributes } from "react";
import styles from "./text-area.module.css";

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hideLabel?: boolean;
  error?: string;
  id?: string;
}

export function TextArea({ label, hideLabel, error, id, rows = 3, className, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={textareaId} className={hideLabel ? styles.visuallyHidden : styles.label}>
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        className={styles.textarea}
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
