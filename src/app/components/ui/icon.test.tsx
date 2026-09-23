// @vitest-environment jsdom
// Task 5.5: specs/design-system/spec.md "Give every icon-only control an
// accessible name" — "Purely decorative imagery … SHALL be hidden from
// assistive technology". This enumerates every exported icon in the set and
// asserts each one renders hidden, rather than pinning individual icons by
// name, so a new icon added later is covered automatically.
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import * as Icons from "./icon";

afterEach(() => {
  cleanup();
});

const iconComponents = Object.entries(Icons).filter(
  (entry): entry is [string, (props: { size?: number }) => ReactElement] =>
    entry[0].endsWith("Icon") && typeof entry[1] === "function",
);

describe("icon set", () => {
  it("exports at least one icon", () => {
    expect(iconComponents.length).toBeGreaterThan(0);
  });

  it.each(iconComponents)("%s renders hidden from assistive technology", (_name, IconComponent) => {
    const { container } = render(<IconComponent />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(svg?.querySelector("title")).toBeNull();
  });

  it.each(iconComponents)("%s accepts a size and applies it to both dimensions", (_name, IconComponent) => {
    const { container } = render(<IconComponent size={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });
});
