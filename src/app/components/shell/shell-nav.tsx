// workflow-board-ui task 6.3 (specs/github-app-installation/spec.md "Present
// a thin signed-in repository and discovery surface", scenario "repository
// view is reachable from the board"; design.md Decision 9): the signed-in
// navigation — Board (`/`) and Repositories (`/repositories`). The page
// names which item is current; that item carries `aria-current="page"`.
//
// The same list renders in two places: in the top app bar at 760px and
// above, and inside the account menu below 760px (the bar has no room for it
// there). Which one is shown is CSS only (top-app-bar.module.css,
// account-menu.module.css); nothing here reads the viewport.
import styles from "./shell-nav.module.css";

export type ShellNavId = "board" | "repositories";

export interface ShellNavItem {
  id: ShellNavId;
  label: string;
  href: string;
}

export const SHELL_NAV_ITEMS: readonly ShellNavItem[] = [
  { id: "board", label: "Board", href: "/" },
  { id: "repositories", label: "Repositories", href: "/repositories" },
];

export const SHELL_NAV_LABEL = "Primary";

export interface ShellNavProps {
  current: ShellNavId;
  /** "bar": a horizontal row in the top app bar; "menu": a stacked list in the account menu. */
  placement: "bar" | "menu";
}

export function ShellNav({ current, placement }: ShellNavProps) {
  return (
    <nav aria-label={SHELL_NAV_LABEL} className={styles.nav} data-shell-nav={placement}>
      <ul className={placement === "bar" ? styles.row : styles.stack}>
        {SHELL_NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              className={styles.link}
              aria-current={item.id === current ? "page" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
