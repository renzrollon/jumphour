// Task 8.1: SignInLink is a plain anchor to the caller-supplied GitHub OAuth
// URL (../../server/github/sign-in-url.ts#buildGithubSignInUrl builds it).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SignInLink } from "./sign-in-link";

describe("SignInLink", () => {
  it("links to the given href", () => {
    const html = renderToStaticMarkup(<SignInLink href="https://github.com/login/oauth/authorize?client_id=abc" />);

    expect(html).toContain('href="https://github.com/login/oauth/authorize?client_id=abc"');
    expect(html).toContain("Sign in with GitHub");
  });
});
