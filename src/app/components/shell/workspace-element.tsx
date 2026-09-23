// Task 8.2 (specs/app-shell/spec.md "Name the workspace from the real GitHub
// App installation"): the top app bar's workspace element, rendered from a
// `WorkspaceView` (./workspace.ts, over `getInstallation()`).
//
//   - Fewer than two stored installations: a static, non-interactive label —
//     the current installation's account login, or the neutral
//     "No installation" when the session names none or names one with no
//     stored row.
//   - Two or more: a switcher (a native select in a plain form, so it works
//     without client JavaScript) naming each installation by account login,
//     with the installation the page is showing selected, so the label and
//     the page never disagree. When the page is showing no stored
//     installation, the neutral "No installation" option is the selected one.
//
// No numeric identifier is ever rendered as text: installation ids appear
// only as the `value` of an option, which the form submits and nobody reads.
// No route consumes the switch yet; `switchAction` is where one plugs in.
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import type { WorkspaceView } from "./workspace";
import styles from "./workspace-element.module.css";

export const NO_INSTALLATION_LABEL = "No installation";

export interface WorkspaceElementProps {
  workspace: WorkspaceView;
  /** Form action a chosen `installationId` is posted to. */
  switchAction?: string;
}

export function WorkspaceElement({ workspace, switchAction }: WorkspaceElementProps) {
  const { current, installations } = workspace;

  if (installations.length < 2) {
    const label = current?.accountLogin ?? NO_INSTALLATION_LABEL;
    return (
      <span className={styles.label} title={label} data-workspace-state={current ? "named" : "none"}>
        {label}
      </span>
    );
  }

  const options = [
    ...(current ? [] : [{ value: "", label: NO_INSTALLATION_LABEL }]),
    ...installations.map((installation) => ({
      value: String(installation.installationId),
      label: installation.accountLogin,
    })),
  ];

  return (
    <form className={styles.switcher} action={switchAction} method="post" data-workspace-state="switcher">
      <Select
        label="Workspace"
        hideLabel
        name="installationId"
        options={options}
        defaultValue={current ? String(current.installationId) : ""}
      />
      <Button type="submit" variant="ghost">
        Switch
      </Button>
    </form>
  );
}
