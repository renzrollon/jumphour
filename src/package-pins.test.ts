// design-system-and-app-shell task 1.3 (CLAUDE.md "Version pinning"; design.md
// Decision 5): every dependency is pinned to one exact version — no `^`, `~`,
// `latest`, range, tag, or URL — and the packages Decision 5 deliberately
// leaves out stay out.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as PackageJson;

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Decision 5's "Deliberately not added" list: matchers sugar, a Vite plugin, Storybook, Playwright. */
const EXCLUDED = [
  /^@testing-library\/jest-dom$/,
  /^@vitejs\/plugin-react(?:-swc)?$/,
  /^storybook$/,
  /^@storybook\//,
  /^playwright(?:-core)?$/,
  /^@playwright\//,
];

/** Every declared [name, version], section by section, so a name listed twice is checked twice. */
function allDependencies(pkg: PackageJson): Array<[string, string]> {
  return [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies].flatMap((section) =>
    Object.entries(section ?? {}),
  );
}

/** Every `name@version` whose version is anything but one exact semver version. */
function nonExactPins(pkg: PackageJson): string[] {
  return allDependencies(pkg)
    .filter(([, version]) => !EXACT_VERSION.test(version))
    .map(([name, version]) => `${name}@${version}`);
}

/** Every declared dependency Decision 5 keeps out of the project. */
function excludedPackages(pkg: PackageJson): string[] {
  return allDependencies(pkg)
    .map(([name]) => name)
    .filter((name) => EXCLUDED.some((pattern) => pattern.test(name)));
}

describe("package.json dependency pins", () => {
  it("declares dependencies to check", () => {
    expect(Object.keys(manifest.dependencies ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(manifest.devDependencies ?? {}).length).toBeGreaterThan(0);
  });

  it("pins every dependency and devDependency to an exact version", () => {
    expect(nonExactPins(manifest)).toEqual([]);
  });

  it("declares none of the packages design.md Decision 5 leaves out", () => {
    expect(excludedPackages(manifest)).toEqual([]);
  });

  it("rejects every non-exact version form, so a caret range fails the pin check", () => {
    const loose = {
      dependencies: { exact: "1.2.3", prerelease: "30.0.0-rc.1", caret: "^1.2.3", tilde: "~1.2.3" },
      devDependencies: {
        latest: "latest",
        star: "*",
        range: ">=1.0.0 <2.0.0",
        partial: "1.2",
        xrange: "1.x",
        url: "github:owner/repo",
        spaced: " 1.2.3",
      },
    };
    expect(nonExactPins(loose)).toEqual([
      "caret@^1.2.3",
      "tilde@~1.2.3",
      "latest@latest",
      "star@*",
      "range@>=1.0.0 <2.0.0",
      "partial@1.2",
      "xrange@1.x",
      "url@github:owner/repo",
      "spaced@ 1.2.3",
    ]);
  });

  it("flags each excluded package wherever it is declared", () => {
    const pkg = {
      dependencies: { "@testing-library/jest-dom": "6.0.0", react: "19.3.0" },
      devDependencies: { "@vitejs/plugin-react": "5.0.0", storybook: "9.0.0", "@storybook/react": "9.0.0" },
      optionalDependencies: { "@playwright/test": "1.50.0", playwright: "1.50.0" },
    };
    expect(excludedPackages(pkg).sort()).toEqual(
      ["@playwright/test", "@storybook/react", "@testing-library/jest-dom", "@vitejs/plugin-react", "playwright", "storybook"].sort(),
    );
  });
});
