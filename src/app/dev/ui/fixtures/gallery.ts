// Task 10.3 (design.md Decision 9): fixture strings and option lists the
// primitives gallery renders. Plain data only — no callbacks — because these
// values are shared between the server page (./page.tsx) and the client
// gallery (./primitives-gallery.tsx), and a Server Component may only hand a
// Client Component data it can serialize.
import type { ButtonVariant } from "../../../components/ui/button";
import type { SegmentedOption } from "../../../components/ui/segmented-control";
import type { SelectOption } from "../../../components/ui/select";
import type { SourceKind } from "../../../components/ui/source-badge";
import type { Tone } from "../../../components/ui/tone-dot";

export const BUTTON_VARIANTS: readonly { variant: ButtonVariant; label: string }[] = [
  { variant: "primary", label: "Primary" },
  { variant: "secondary", label: "Secondary" },
  { variant: "ghost", label: "Ghost" },
  { variant: "danger", label: "Danger" },
];

export const SEARCH_ICON_BUTTON_LABEL = "Search";
export const DISMISS_ICON_BUTTON_LABEL = "Dismiss";

export const ICON_NAMES = {
  chevronDown: "Chevron down",
  close: "Close",
  check: "Check",
  search: "Search",
  settings: "Settings",
  info: "Info",
  warning: "Warning",
  error: "Error",
  success: "Success",
  clock: "Clock",
  externalLink: "External link",
  spinner: "Spinner",
} as const;

export const SELECT_LABEL = "Repository";
export const SELECT_OPTIONS: readonly SelectOption[] = [
  { value: "alpha", label: "Alpha repository" },
  { value: "beta", label: "Beta repository" },
  { value: "gamma", label: "Gamma repository" },
];

export const TEXT_FIELD_LABEL = "Change name";
export const TEXT_FIELD_PLACEHOLDER = "add-idempotency-keys";
export const TEXT_FIELD_ERROR = "This field is required.";
export const TEXT_AREA_LABEL = "Summary";
export const TEXT_AREA_SAMPLE = "One paragraph describing the change.";
export const TEXT_AREA_ERROR = "Keep the summary under 280 characters.";

export const TONES: readonly Tone[] = ["neutral", "ok", "warn", "bad", "accent"];

export const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "Neutral",
  ok: "Healthy",
  warn: "Delayed",
  bad: "Failed",
  accent: "Highlighted",
};

export const SOURCE_KINDS_DEMO: readonly SourceKind[] = ["github", "gitlab", "jira-mcp", "manual"];

export const SKELETON_LABEL = "Loading ideas";
export const PROGRESS_LABEL = "Checking repository access…";

export const BANNER_DEMOS: readonly { tone: "neutral" | "ok" | "warn" | "bad"; title: string }[] = [
  { tone: "neutral", title: "This is an informational note." },
  { tone: "ok", title: "The source is healthy." },
  { tone: "warn", title: "The snapshot is stale." },
  { tone: "bad", title: "The last sync failed." },
];
export const BANNER_ACTION_LABEL = "Retry";

export interface MenuItemFixture {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const MENU_LABEL = "Demo actions";
export const MENU_TRIGGER_LABEL = "Open menu";
export const MENU_ITEMS: readonly MenuItemFixture[] = [
  { id: "one", label: "First action", description: "A plain, enabled item." },
  { id: "two", label: "Second action" },
  { id: "three", label: "Third action (disabled)", disabled: true },
];
export const MENU_EMPTY_STATUS = "Nothing selected yet.";

export const POPOVER_LABEL = "Demo details";
export const POPOVER_TRIGGER_LABEL = "Open popover";
export const POPOVER_BODY = "A transient surface anchored to its trigger. Escape or an outside click dismisses it.";

export const DIALOG_TRIGGER_LABEL = "Open dialog";
export const DIALOG_TITLE = "Centered dialog";
export const DIALOG_DESCRIPTION = "Focus is trapped inside while it is open.";
export const DIALOG_BODY =
  "Tab and Shift+Tab wrap within this panel, and Escape returns focus to the button that opened it.";
export const DIALOG_BUSY_SWITCH_LABEL = "Simulate work in flight";
export const DIALOG_BUSY_MESSAGE = "Saving…";
export const DIALOG_CONFIRM_LABEL = "Save";

export const SHEET_TRIGGER_LABEL = "Open sheet";
export const SHEET_TITLE = "Right-side sheet";
export const SHEET_DESCRIPTION = "Same overlay behavior as the dialog, docked to the edge instead of centered.";
export const SHEET_BODY = "A sheet shares the dialog's focus trap, Escape handling, and focus restoration.";
export const SHEET_CONFIRM_LABEL = "Done";

export const SEGMENTED_LABEL = "Demo choice";
export const SEGMENTED_OPTIONS: readonly SegmentedOption<"one" | "two" | "three">[] = [
  { value: "one", label: "One" },
  { value: "two", label: "Two" },
  { value: "three", label: "Three" },
];

export const SWITCH_LABEL = "Sample toggle";

export const ILLUSTRATION_CAPTION = "Empty-state art (decorative — hidden from assistive technology)";
