// Task 5.5: an inline status banner (design source: the prototype's "Source
// status banner", lines 122-133 of `Jumphour Board prototype review/
// Jumphour Board.dc.html`). `role` follows tone: `bad` is an assertive
// `alert` (matching the prototype's form-level error banner), every other
// tone is a polite `status` (matching the prototype's source-unavailable
// banner). The tone icon is decorative and paired with the required
// `title` text, so no meaning is carried by tone alone
// (specs/design-system/spec.md "Never convey state by color alone").
import type { ReactNode } from "react";
import { Button } from "./button";
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "./icon";
import styles from "./banner.module.css";

export type BannerTone = "neutral" | "ok" | "warn" | "bad";

export interface BannerAction {
  label: string;
  onClick: () => void;
}

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  children?: ReactNode;
  action?: BannerAction;
  className?: string;
}

const TONE_ICON = {
  neutral: InfoIcon,
  ok: SuccessIcon,
  warn: WarningIcon,
  bad: ErrorIcon,
} as const;

export function Banner({ tone = "neutral", title, children, action, className }: BannerProps) {
  const ToneIcon = TONE_ICON[tone];
  const classes = [styles.banner, styles[tone], className].filter(Boolean).join(" ");

  return (
    <div role={tone === "bad" ? "alert" : "status"} className={classes}>
      <ToneIcon />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
      {action ? (
        <Button type="button" variant="secondary" onClick={action.onClick} className={styles.action}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
