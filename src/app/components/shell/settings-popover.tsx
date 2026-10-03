"use client";

// Task 8.5 (specs/app-shell/spec.md "Present appearance settings in a settings
// surface"): the settings surface opened from the top app bar's settings
// entry. It holds exactly two sections — Appearance (the theme choice) and
// Cats (the cats toggle with its description bound through
// aria-describedby) — and nothing else: no token, password, connection,
// billing, or team-administration control.
//
// Both sections reuse 8.4's ThemeControl and CatsToggle over the same
// server-read `appearance` the bar's controls receive, so the popover and the
// bar cannot disagree: neither holds a local copy of the choice, and a change
// made in either one arrives in both with the revalidated render.
import { useId } from "react";
import { IconButton } from "../ui/icon-button";
import { SettingsIcon } from "../ui/icon";
import { Popover } from "../ui/popover";
import type { Appearance } from "../../../lib/appearance/appearance";
import { ThemeControl } from "./theme-control";
import { CatsToggle } from "./cats-toggle";
import styles from "./settings-popover.module.css";

export const CATS_DESCRIPTION = "Adds subtle cat accents without changing the board.";

export interface SettingsPopoverProps {
  appearance: Appearance;
}

export function SettingsPopover({ appearance }: SettingsPopoverProps) {
  const id = useId();
  const appearanceHeading = `${id}-appearance`;
  const catsHeading = `${id}-cats`;
  const catsDescription = `${id}-cats-description`;
  return (
    <Popover
      label="Settings"
      align="end"
      renderTrigger={(trigger) => (
        <IconButton {...trigger} icon={<SettingsIcon />} aria-label="Settings" variant="ghost" />
      )}
    >
      <div className={styles.body}>
        <section className={styles.section} aria-labelledby={appearanceHeading} data-settings-section="appearance">
          <h2 id={appearanceHeading} className={styles.heading}>
            Appearance
          </h2>
          <ThemeControl appearance={appearance} />
        </section>
        <section className={styles.section} aria-labelledby={catsHeading} data-settings-section="cats">
          <h2 id={catsHeading} className={styles.heading}>
            Cats
          </h2>
          <CatsToggle appearance={appearance} describedBy={catsDescription} />
          <p id={catsDescription} className={styles.description}>
            {CATS_DESCRIPTION}
          </p>
        </section>
      </div>
    </Popover>
  );
}
