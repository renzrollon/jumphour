// Task 9.2 (specs/app-shell/spec.md "Offer GitHub sign-in on a signed-out
// view in the same visual system" and "Land a completed sign-in on the
// signed-in surface"; design.md Decision 6): the signed-out entry view,
// built from the same tokens and primitives as the shell. It offers exactly
// one action — SignInLink — and only when the caller could build a working
// sign-in URL. Without one it says plainly that GitHub OAuth is not
// configured and offers no action, naming no configuration value.
//
// `signInFailed` is the `?signin=failed` marker the OAuth callback redirects
// to. It selects a FIXED notice: nothing from the request (code, state,
// provider error, internal reason) is accepted here, so nothing of it can be
// rendered.
import { SignInLink } from "./sign-in-link";
import { Banner } from "./ui/banner";
import styles from "./signed-out-view.module.css";

export const SIGN_IN_FAILED_TITLE = "Sign-in did not complete";
export const SIGN_IN_FAILED_DETAIL = "You are not signed in. You can try signing in with GitHub again.";
export const OAUTH_NOT_CONFIGURED_EXPLANATION =
  "GitHub OAuth is not configured for this deployment, so sign-in is unavailable. Ask the person who runs this Jumphour deployment to set it up.";

export interface SignedOutViewProps {
  /** The GitHub sign-in URL, or null when GitHub OAuth is not configured. */
  signInHref: string | null;
  /** True when the browser arrived with `?signin=failed`. */
  signInFailed: boolean;
}

export function SignedOutView({ signInHref, signInFailed }: SignedOutViewProps) {
  return (
    <main className={styles.page} data-shell-region="signed-out">
      <div className={styles.card}>
        <div className={styles.brand}>
          <svg className={styles.mark} width={32} height={32} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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
          <h1 className={styles.title}>Jumphour</h1>
        </div>

        {signInFailed ? (
          <Banner tone="bad" title={SIGN_IN_FAILED_TITLE}>
            {SIGN_IN_FAILED_DETAIL}
          </Banner>
        ) : null}

        {signInHref ? (
          <>
            <p className={styles.lede}>Sign in with your GitHub account to see your repositories.</p>
            <div className={styles.action}>
              <SignInLink href={signInHref} />
            </div>
          </>
        ) : (
          <p className={styles.lede}>{OAUTH_NOT_CONFIGURED_EXPLANATION}</p>
        )}
      </div>
    </main>
  );
}
