// Task 8.1: the "GitHub sign-in" screen design.md Decision 8 lists first.
// Purely presentational — `href` is built by
// ../../server/github/sign-in-url.ts#buildGithubSignInUrl from the
// caller's own client id and redirect URI; this component only renders the
// link.
export interface SignInLinkProps {
  href: string;
}

export function SignInLink({ href }: SignInLinkProps) {
  return <a href={href}>Sign in with GitHub</a>;
}
