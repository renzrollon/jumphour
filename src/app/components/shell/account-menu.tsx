"use client";

// Task 8.3 (specs/app-shell/spec.md "Identify the signed-in account and offer
// sign out"): the account menu. The trigger shows the GitHub login (or the
// neutral "Account"); the surface identifies the signed-in account and offers
// exactly one action — a plain form POSTing to the local-only sign-out route
// (design.md Decision 7). A form rather than a scripted menu item, so sign-out
// is a real POST that works without client JavaScript and a prefetch can
// never trigger it. Nothing else lives here: no administration, billing,
// token, or source-credential item.
//
// Built on Popover (a transient surface on the shared overlay core) rather
// than Menu, because its content is an identity line plus a form, not a list
// of scripted actions.
import { Popover } from "../ui/popover";
import type { AccountView } from "./account";
import styles from "./account-menu.module.css";

export const SIGN_OUT_ACTION = "/api/session/signout";
export const NEUTRAL_ACCOUNT_TRIGGER = "Account";
export const NEUTRAL_ACCOUNT_LABEL = "GitHub account name unavailable";

export interface AccountMenuProps {
  account: AccountView;
}

export function AccountMenu({ account }: AccountMenuProps) {
  const { login } = account;
  return (
    <Popover
      label="Account"
      align="end"
      renderTrigger={(trigger) => (
        <button {...trigger} className={styles.trigger} title={login ?? undefined}>
          <span className={styles.triggerLabel}>{login ?? NEUTRAL_ACCOUNT_TRIGGER}</span>
        </button>
      )}
    >
      <div className={styles.body}>
        <p className={styles.caption}>Signed in with GitHub as</p>
        <p className={styles.identity} data-account-state={login ? "named" : "unknown"}>
          {login ?? NEUTRAL_ACCOUNT_LABEL}
        </p>
        <form method="post" action={SIGN_OUT_ACTION} className={styles.signOut}>
          <button type="submit" className={styles.signOutButton}>
            Sign out
          </button>
        </form>
      </div>
    </Popover>
  );
}
