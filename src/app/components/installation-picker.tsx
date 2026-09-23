// Task 8.1: "optional installation picker" — design.md Decision 3: "A
// signed-in user who belongs to multiple installations gets an installation
// switcher; lists and reports never merge." specs/github-app-installation
// /spec.md's switcher scenarios ("Edge case — same GitHub user in two
// installations") only describe behavior once a second installation exists,
// so this renders nothing when there is at most one — the picker is optional
// precisely because most signed-in users never see it.
//
// Purely presentational: it names the target installation via `<form>` +
// `<select name="installationId">` submitting to `action`, so a route can
// wire the actual switch (task 7.2's switchCurrentInstallation) without this
// component importing a driver or GitHub client of its own.
//
// design-system-and-app-shell task 9.3: restyled through
// installation-picker.module.css — class names only; the form, label,
// select and submit button, and the exported props, are unchanged.
import styles from "./installation-picker.module.css";

export interface InstallationOption {
  installationId: number;
  accountLogin: string;
}

export interface InstallationPickerProps {
  installations: readonly InstallationOption[];
  currentInstallationId: number | null;
  /** Form action the picker submits the chosen `installationId` to. */
  action?: string;
}

export function InstallationPicker({ installations, currentInstallationId, action }: InstallationPickerProps) {
  if (installations.length < 2) {
    return null;
  }

  return (
    <form action={action} className={styles.form}>
      <label className={styles.label}>
        Installation
        <select className={styles.select} name="installationId" defaultValue={currentInstallationId ?? undefined}>
          {installations.map((installation) => (
            <option key={installation.installationId} value={installation.installationId}>
              {installation.accountLogin}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.button}>
        Switch
      </button>
    </form>
  );
}
