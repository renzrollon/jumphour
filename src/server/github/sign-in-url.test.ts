// Task 8.1: buildGithubSignInUrl is pure string-building, so these are plain
// assertions on the returned URL rather than a network fixture.
import { describe, expect, it } from "vitest";
import { buildGithubSignInUrl } from "./sign-in-url";

describe("buildGithubSignInUrl", () => {
  it("points at GitHub's OAuth authorize endpoint with client_id and redirect_uri", () => {
    const href = buildGithubSignInUrl({
      clientId: "Iv1.abc123",
      redirectUri: "http://localhost:3000/api/github/oauth/callback",
    });

    const url = new URL(href);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc123");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/github/oauth/callback");
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("includes state only when supplied", () => {
    const href = buildGithubSignInUrl({
      clientId: "Iv1.abc123",
      redirectUri: "http://localhost:3000/api/github/oauth/callback",
      state: "xyz789",
    });

    expect(new URL(href).searchParams.get("state")).toBe("xyz789");
  });
});
