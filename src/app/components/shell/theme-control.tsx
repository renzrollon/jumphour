"use client";

// Task 8.4 (specs/appearance-preferences/spec.md "Offer exactly three theme
// choices", "Keep the cats layer off by default and purely decorative"): the
// top app bar's theme control, a SegmentedControl over the three choices.
//
// The checked option is the server-read preference passed in as `theme`,
// never a local copy, so this control, the root layout's `data-jh-theme`
// and the settings surface cannot disagree. Choosing calls the server
// action, which sets the cookie and revalidates; the new presentation
// arrives with the server re-render. Nothing here reads `matchMedia`,
// touches `document`, or computes a resolved theme (design.md invariant
// sweep, "Resolved theme").
//
// With cats on, the Light and Dark options show playful visible labels; the
// accessible names stay "System theme", "Light theme" and "Dark theme".
import { useTransition } from "react";
import { SegmentedControl, type SegmentedOption } from "../ui/segmented-control";
import type { Appearance, Theme } from "../../../lib/appearance/appearance";
import { setThemePreference } from "./appearance-actions";

export const THEME_ACCESSIBLE_NAMES: Record<Theme, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

const PLAIN_LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
const CATS_LABELS: Record<Theme, string> = { system: "System", light: "Sunny spot", dark: "Night prowl" };

export function themeOptions(cats: Appearance["cats"]): SegmentedOption<Theme>[] {
  const labels = cats === "on" ? CATS_LABELS : PLAIN_LABELS;
  return (["system", "light", "dark"] as const).map((value) => ({
    value,
    label: labels[value],
    accessibleName: THEME_ACCESSIBLE_NAMES[value],
  }));
}

export interface ThemeControlProps {
  appearance: Appearance;
}

export function ThemeControl({ appearance }: ThemeControlProps) {
  const [pending, startTransition] = useTransition();
  return (
    <div aria-busy={pending || undefined}>
      <SegmentedControl
        label="Theme"
        options={themeOptions(appearance.cats)}
        value={appearance.theme}
        onChange={(theme) => startTransition(() => setThemePreference(theme))}
      />
    </div>
  );
}
