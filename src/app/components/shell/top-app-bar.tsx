// Task 8.1 (specs/app-shell/spec.md "Frame every signed-in view in one top
// app bar"): composes the top app bar's seven regions in the fixed order the
// requirement lists them — mark and wordmark, workspace element, search
// slot, theme control, cats toggle, settings entry, account menu — so every
// signed-in view gets exactly one of each, never a second. Each region
// carries a stable `data-shell-slot` so later tasks can replace its contents
// without renaming what this task's own test (and a later conformance test)
// locates, and so its content stays queryable by accessible role/name where
// one applies, matching how the rest of this codebase's component tests
// query (see icon-button.test.tsx, switch.test.tsx).
//
// What each region renders today, and which later task in group 8 replaces
// it:
//   - mark/wordmark: final as written here.
//   - workspace: 8.2's `WorkspaceElement`, from `resolveWorkspace()` over
//     `getInstallation()` — the account login, the neutral "No installation"
//     (design.md Decision 8), or a switcher with two or more installations.
//   - search: whatever the view passes as `search` (workflow-board-ui task
//     4.4: the board's search field). A view that passes nothing — the
//     repositories page — leaves the slot empty and hidden from assistive
//     technology; nothing here measures or assumes its contents.
//   - theme control / cats toggle: 8.4's `ThemeControl`/`CatsToggle`, over
//     the server-read appearance and the appearance server actions.
//   - settings entry: 8.5's `SettingsPopover`, a `Popover` whose trigger is
//     the same ghost `IconButton` named "Settings", holding the theme choice
//     and the cats toggle over the same `appearance` as the bar's controls.
//   - account menu: 8.3's `AccountMenu`, from `resolveAccount()` over
//     `getUser()` — the GitHub login (or the neutral "Account") and the
//     sign-out form.
//
// Task 8.6 (specs/app-shell/spec.md "Keep settings and the account reachable
// on a narrow viewport"): below 760px the module CSS hides the search region
// and the `wideOnly` theme/cats slots; both preferences stay changeable in
// the settings popover, and the settings entry and account menu stay in the
// bar. CSS only (design.md Decision 10) — nothing here reads the width.
//
// workflow-board-ui task 6.3: a view that names its `currentNav` gets the
// Board / Repositories navigation (./shell-nav.tsx) between the workspace
// element and the search slot at 760px and above; below 760px the module
// CSS hides it here and the account menu carries the same list instead.
// It is not a `data-shell-slot` region, so the seven regions above keep
// their fixed order and count.
import type { ReactNode } from "react";
import { NO_WORKSPACE, type WorkspaceView } from "./workspace";
import { UNKNOWN_ACCOUNT, type AccountView } from "./account";
import { AccountMenu } from "./account-menu";
import { ThemeControl } from "./theme-control";
import { CatsToggle } from "./cats-toggle";
import { SettingsPopover } from "./settings-popover";
import { DEFAULT_APPEARANCE, type Appearance } from "../../../lib/appearance/appearance";
import { WorkspaceElement } from "./workspace-element";
import { ShellNav, type ShellNavId } from "./shell-nav";
import styles from "./top-app-bar.module.css";

export interface TopAppBarProps {
  /** Task 8.2: from `resolveWorkspace()`; defaults to the neutral "No installation". */
  workspace?: WorkspaceView;
  /** Task 8.3: from `resolveAccount()`; defaults to the neutral account label. */
  account?: AccountView;
  /** Task 8.4: the server-read preference (`parseAppearance()`); defaults to Light, cats off. */
  appearance?: Appearance;
  /** The view's search control for the search slot; omitted, the slot stays empty. */
  search?: ReactNode;
  /** Task 6.3: the signed-in navigation item this view is; omitted, no navigation renders. */
  currentNav?: ShellNavId;
}

export function TopAppBar({
  workspace = NO_WORKSPACE,
  account = UNKNOWN_ACCOUNT,
  appearance = DEFAULT_APPEARANCE,
  search,
  currentNav,
}: TopAppBarProps = {}) {
  const hasSearch = search !== undefined && search !== null && search !== false;
  return (
    <header className={styles.bar} data-shell-region="top-app-bar">
      <div className={styles.brand} data-shell-slot="mark">
        <svg
          className={styles.mark}
          width={24}
          height={24}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="var(--accent)" />
          <path
            d="M9.5 7.5v7.3a2.7 2.7 0 0 1-2.7 2.7"
            fill="none"
            stroke="var(--accentInk)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="15.3" cy="8.2" r="1" fill="var(--accentInk)" />
        </svg>
        <span className={styles.wordmark}>Jumphour</span>
      </div>

      <div className={styles.workspace} data-shell-slot="workspace">
        <WorkspaceElement workspace={workspace} />
      </div>

      {currentNav !== undefined ? (
        <div className={styles.nav}>
          <ShellNav current={currentNav} placement="bar" />
        </div>
      ) : null}

      <div className={styles.search} data-shell-slot="search" aria-hidden={hasSearch ? undefined : "true"}>
        {hasSearch ? search : null}
      </div>

      <div className={styles.controls}>
        <div className={styles.wideOnly} data-shell-slot="theme-control">
          <ThemeControl appearance={appearance} />
        </div>
        <div className={styles.wideOnly} data-shell-slot="cats-toggle">
          <CatsToggle appearance={appearance} />
        </div>
        <div data-shell-slot="settings-entry">
          <SettingsPopover appearance={appearance} />
        </div>
        <div data-shell-slot="account-menu">
          <AccountMenu account={account} currentNav={currentNav} />
        </div>
      </div>
    </header>
  );
}
