// Task 8.1 (specs/app-shell/spec.md "Frame every signed-in view in one top
// app bar"): the shell frame every signed-in view renders inside. It renders
// the top app bar once, above whatever content the caller passes as
// `children`; the bar's own `position: sticky` (top-app-bar.module.css) is
// what keeps it visible while `children` scrolls — this component holds no
// scroll or resize logic of its own.
import type { ReactNode } from "react";
import { TopAppBar, type TopAppBarProps } from "./top-app-bar";
import styles from "./app-shell.module.css";

export interface AppShellProps extends TopAppBarProps {
  children: ReactNode;
}

export function AppShell({ children, ...bar }: AppShellProps) {
  return (
    <div className={styles.frame} data-shell-region="app-shell">
      <TopAppBar {...bar} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
