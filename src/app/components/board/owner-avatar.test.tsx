// Task 3.3: stable owner-key hash to one of four token pairs; no hex literals.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AVATAR_PAIRS, OwnerAvatar, avatarPair, ownerInitials } from "./owner-avatar";

describe("OwnerAvatar", () => {
  it("maps the same name to the same pair every time", () => {
    for (const name of ["Maya Chen", "Diego Ruiz", "Ana", "李雷"]) {
      const first = avatarPair(name);
      for (let i = 0; i < 5; i++) expect(avatarPair(name)).toBe(first);
      expect(AVATAR_PAIRS).toContain(first);
    }
  });

  it("hashes the owner key, so spacing and NFC variants share a pair", () => {
    const a = renderToStaticMarkup(<OwnerAvatar owner={{ displayName: "  José Diaz " }} />);
    const b = renderToStaticMarkup(<OwnerAvatar owner={{ displayName: "José Diaz" }} />);
    expect(a).toBe(b);
    expect(a).toContain(`data-pair="${avatarPair("José Diaz")}"`);
  });

  it("uses more than one pair across names", () => {
    const pairs = new Set(Array.from({ length: 40 }, (_, i) => avatarPair(`Owner ${i}`)));
    expect(pairs.size).toBeGreaterThan(1);
  });

  it("renders initials", () => {
    expect(ownerInitials("maya chen")).toBe("MC");
    expect(ownerInitials("Ana")).toBe("A");
  });

  it("stylesheet uses tokens and contains no hex color literal", () => {
    const css = readFileSync(new URL("./owner-avatar.module.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const t of ["accent", "green", "amber", "jira"]) {
      expect(css).toContain(`var(--${t}Soft)`);
      expect(css).toContain(`var(--${t})`);
    }
  });
});
