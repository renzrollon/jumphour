// Task 8.1: the "GitHub sign-in" screen design.md Decision 8 lists first.
// Purely presentational — `href` is built by
// ../../server/github/sign-in-url.ts#buildGithubSignInUrl from the
// caller's own client id and redirect URI; this component only renders the
// link.
//
// design-system-and-app-shell task 9.3: restyled through
// sign-in-link.module.css as a primary action — still a plain anchor with
// the same text and the same `href` prop.
import styles from "./sign-in-link.module.css";

export interface SignInLinkProps {
  href: string;
}

export function SignInLink({ href }: SignInLinkProps) {
  return (
    <a href={href} className={styles.link}>
      Sign in with GitHub
    </a>
  );
}
