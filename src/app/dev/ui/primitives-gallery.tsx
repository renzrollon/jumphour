"use client";

// Task 10.3 (design.md Decision 9; Decision 4's "Rejected: ... Storybook — a
// large dependency tree and a second rendering environment for what one
// guarded route provides"): the /dev/ui index's primitives showcase — every
// primitive design.md Decision 11 lists (Button, IconButton, Select,
// TextField, TextArea, Badge, SourceBadge, Menu, Popover, Dialog, Sheet,
// Skeleton, Banner, Switch, SegmentedControl, the icon set), plus ToneDot,
// ProgressIndicator, and Illustration.
//
// One client boundary for the whole showcase: Dialog/Sheet's open state,
// Menu's selection, and SegmentedControl's/Switch's controlled value all need
// local state and callback props, and a Server Component cannot hand a
// Client Component a function — only the guard, the cookie read, and the
// fixture identity data stay server-side in ./page.tsx. "Both presentations"
// (task 10.3) come from the real theme control this page's shell already
// carries (design.md invariant sweep, "Appearance preference" row names the
// preview gallery as a reader of the same server-read value every other
// control reads) — nothing here computes or overrides a resolved theme.
//
// Every string below is fixture data from ./fixtures/gallery.ts; nothing here
// reads a real installation, user, or repository row.
import { useId, useState, type ComponentType, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { Select } from "../../components/ui/select";
import { TextField } from "../../components/ui/text-field";
import { TextArea } from "../../components/ui/text-area";
import { Badge } from "../../components/ui/badge";
import { SourceBadge } from "../../components/ui/source-badge";
import { Menu } from "../../components/ui/menu";
import { Popover } from "../../components/ui/popover";
import { Dialog } from "../../components/ui/dialog";
import { Sheet } from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { Banner } from "../../components/ui/banner";
import { Switch } from "../../components/ui/switch";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { ToneDot } from "../../components/ui/tone-dot";
import { ProgressIndicator } from "../../components/ui/progress-indicator";
import { Illustration } from "../../components/ui/illustration";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  ErrorIcon,
  ExternalLinkIcon,
  InfoIcon,
  SearchIcon,
  SettingsIcon,
  SpinnerIcon,
  SuccessIcon,
  WarningIcon,
  type IconProps,
} from "../../components/ui/icon";
import {
  BANNER_ACTION_LABEL,
  BANNER_DEMOS,
  BUTTON_VARIANTS,
  DIALOG_BODY,
  DIALOG_BUSY_MESSAGE,
  DIALOG_BUSY_SWITCH_LABEL,
  DIALOG_CONFIRM_LABEL,
  DIALOG_DESCRIPTION,
  DIALOG_TITLE,
  DIALOG_TRIGGER_LABEL,
  DISMISS_ICON_BUTTON_LABEL,
  ICON_NAMES,
  ILLUSTRATION_CAPTION,
  MENU_EMPTY_STATUS,
  MENU_ITEMS,
  MENU_LABEL,
  MENU_TRIGGER_LABEL,
  POPOVER_BODY,
  POPOVER_LABEL,
  POPOVER_TRIGGER_LABEL,
  PROGRESS_LABEL,
  SEARCH_ICON_BUTTON_LABEL,
  SEGMENTED_LABEL,
  SEGMENTED_OPTIONS,
  SELECT_LABEL,
  SELECT_OPTIONS,
  SHEET_BODY,
  SHEET_CONFIRM_LABEL,
  SHEET_DESCRIPTION,
  SHEET_TITLE,
  SHEET_TRIGGER_LABEL,
  SKELETON_LABEL,
  SOURCE_KINDS_DEMO,
  SWITCH_LABEL,
  TEXT_AREA_ERROR,
  TEXT_AREA_LABEL,
  TEXT_AREA_SAMPLE,
  TEXT_FIELD_ERROR,
  TEXT_FIELD_LABEL,
  TEXT_FIELD_PLACEHOLDER,
  TONE_LABELS,
  TONES,
} from "./fixtures/gallery";
import styles from "./dev-ui.module.css";

export const PREVIEW_LABEL = "Preview — fixture data";

const ICON_BUTTON_DEMOS: ReadonlyArray<{
  ariaLabel: string;
  variant: "outline" | "ghost";
  Icon: ComponentType<IconProps>;
}> = [
  { ariaLabel: SEARCH_ICON_BUTTON_LABEL, variant: "outline", Icon: SearchIcon },
  { ariaLabel: DISMISS_ICON_BUTTON_LABEL, variant: "ghost", Icon: CloseIcon },
];

const ICONS: ReadonlyArray<{ key: keyof typeof ICON_NAMES; Icon: ComponentType<IconProps> }> = [
  { key: "chevronDown", Icon: ChevronDownIcon },
  { key: "close", Icon: CloseIcon },
  { key: "check", Icon: CheckIcon },
  { key: "search", Icon: SearchIcon },
  { key: "settings", Icon: SettingsIcon },
  { key: "info", Icon: InfoIcon },
  { key: "warning", Icon: WarningIcon },
  { key: "error", Icon: ErrorIcon },
  { key: "success", Icon: SuccessIcon },
  { key: "clock", Icon: ClockIcon },
  { key: "externalLink", Icon: ExternalLinkIcon },
  { key: "spinner", Icon: SpinnerIcon },
];

function Section({
  title,
  layout = "row",
  children,
}: {
  title: string;
  layout?: "row" | "grid" | "column";
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId} data-preview-section={title}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>
      <div className={styles[layout]}>{children}</div>
    </section>
  );
}

export function PrimitivesGallery() {
  const [menuSelection, setMenuSelection] = useState<string | null>(null);
  const [segmentedValue, setSegmentedValue] = useState<"one" | "two" | "three">("one");
  const [switchChecked, setSwitchChecked] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogBusy, setDialogBusy] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={styles.page}>
      <p role="status" className={styles.label} data-preview-label="true">
        {PREVIEW_LABEL}
      </p>

      <Section title="Button">
        {BUTTON_VARIANTS.map(({ variant, label }) => (
          <Button key={variant} variant={variant}>
            {label}
          </Button>
        ))}
      </Section>

      <Section title="IconButton">
        {ICON_BUTTON_DEMOS.map(({ ariaLabel, variant, Icon }) => (
          <IconButton key={ariaLabel} icon={<Icon />} aria-label={ariaLabel} variant={variant} />
        ))}
      </Section>

      <Section title="Icon set" layout="grid">
        {ICONS.map(({ key, Icon }) => (
          <span key={key} className={styles.iconTile}>
            <Icon size={20} />
            <span className={styles.iconName}>{ICON_NAMES[key]}</span>
          </span>
        ))}
      </Section>

      <Section title="Select, TextField, TextArea" layout="column">
        <Select label={SELECT_LABEL} options={SELECT_OPTIONS} defaultValue={SELECT_OPTIONS[0]?.value} />
        <TextField label={TEXT_FIELD_LABEL} placeholder={TEXT_FIELD_PLACEHOLDER} error={TEXT_FIELD_ERROR} />
        <TextArea label={TEXT_AREA_LABEL} defaultValue={TEXT_AREA_SAMPLE} error={TEXT_AREA_ERROR} />
      </Section>

      <Section title="Badge">
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {TONE_LABELS[tone]}
          </Badge>
        ))}
        <Badge tone="ok" dot={false}>
          {`${TONE_LABELS.ok} (no dot)`}
        </Badge>
      </Section>

      <Section title="SourceBadge">
        {SOURCE_KINDS_DEMO.map((source) => (
          <SourceBadge key={source} source={source} />
        ))}
      </Section>

      <Section title="ToneDot" layout="column">
        {TONES.map((tone) => (
          <span key={tone} className={styles.row}>
            <ToneDot tone={tone} />
            <span>{TONE_LABELS[tone]}</span>
          </span>
        ))}
      </Section>

      <Section title="Banner" layout="column">
        {BANNER_DEMOS.map((demo, index) => (
          <Banner
            key={demo.title}
            tone={demo.tone}
            title={demo.title}
            action={index === BANNER_DEMOS.length - 1 ? { label: BANNER_ACTION_LABEL, onClick: () => {} } : undefined}
          />
        ))}
      </Section>

      <Section title="Skeleton and ProgressIndicator" layout="column">
        <Skeleton label={SKELETON_LABEL} rows={3} />
        <ProgressIndicator label={PROGRESS_LABEL} />
      </Section>

      <Section title="Menu" layout="column">
        <Menu
          label={MENU_LABEL}
          renderTrigger={(trigger) => (
            <Button {...trigger} variant="secondary">
              {MENU_TRIGGER_LABEL}
            </Button>
          )}
          items={MENU_ITEMS.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            disabled: item.disabled,
            onSelect: () => setMenuSelection(item.label),
          }))}
        />
        <p role="status" className={styles.status}>
          {menuSelection ? `Last selected: ${menuSelection}` : MENU_EMPTY_STATUS}
        </p>
      </Section>

      <Section title="Popover">
        <Popover
          label={POPOVER_LABEL}
          renderTrigger={(trigger) => (
            <Button {...trigger} variant="secondary">
              {POPOVER_TRIGGER_LABEL}
            </Button>
          )}
        >
          <p className={styles.status}>{POPOVER_BODY}</p>
        </Popover>
      </Section>

      <Section title="Dialog" layout="column">
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            {DIALOG_TRIGGER_LABEL}
          </Button>
          <Switch checked={dialogBusy} onChange={setDialogBusy}>
            {DIALOG_BUSY_SWITCH_LABEL}
          </Switch>
        </div>
        <Dialog
          open={dialogOpen}
          title={DIALOG_TITLE}
          description={DIALOG_DESCRIPTION}
          closeGuard={dialogBusy}
          busyMessage={DIALOG_BUSY_MESSAGE}
          onClose={() => setDialogOpen(false)}
          footer={
            <div className={styles.dialogFooter}>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                {DIALOG_CONFIRM_LABEL}
              </Button>
            </div>
          }
        >
          <p>{DIALOG_BODY}</p>
        </Dialog>
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          {SHEET_TRIGGER_LABEL}
        </Button>
        <Sheet
          open={sheetOpen}
          title={SHEET_TITLE}
          description={SHEET_DESCRIPTION}
          onClose={() => setSheetOpen(false)}
          footer={
            <div className={styles.dialogFooter}>
              <Button variant="primary" onClick={() => setSheetOpen(false)}>
                {SHEET_CONFIRM_LABEL}
              </Button>
            </div>
          }
        >
          <p>{SHEET_BODY}</p>
        </Sheet>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl label={SEGMENTED_LABEL} options={SEGMENTED_OPTIONS} value={segmentedValue} onChange={setSegmentedValue} />
      </Section>

      <Section title="Switch">
        <Switch checked={switchChecked} onChange={setSwitchChecked}>
          {SWITCH_LABEL}
        </Switch>
      </Section>

      <Section title="Illustration">
        <Illustration>
          <svg width={48} height={48} viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Illustration>
        <p className={styles.status}>{ILLUSTRATION_CAPTION}</p>
      </Section>
    </div>
  );
}
