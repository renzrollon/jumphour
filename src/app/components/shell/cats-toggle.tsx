"use client";

// Task 8.4 (specs/appearance-preferences/spec.md "Keep the cats layer off by
// default and purely decorative"): the cats toggle, a Switch whose checked
// state is the server-read preference. Toggling calls the server action; the
// new state arrives with the revalidated render, like the theme control.
// `describedBy` lets the settings surface (8.5) bind its description.
import { useTransition } from "react";
import { Switch } from "../ui/switch";
import type { Appearance } from "../../../lib/appearance/appearance";
import { setCatsPreference } from "./appearance-actions";

export interface CatsToggleProps {
  appearance: Appearance;
  describedBy?: string;
}

export function CatsToggle({ appearance, describedBy }: CatsToggleProps) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={appearance.cats === "on"}
      aria-describedby={describedBy}
      aria-busy={pending || undefined}
      onChange={(checked) => startTransition(() => setCatsPreference(checked ? "on" : "off"))}
    >
      Cats theme
    </Switch>
  );
}
