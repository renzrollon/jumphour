// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "./badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("renders its label as visible text", () => {
    render(<Badge tone="ok">Healthy</Badge>);
    expect(screen.getByText("Healthy")).not.toBeNull();
  });

  it("hides its tone dot from assistive technology", () => {
    const { container } = render(<Badge tone="warn">Delayed</Badge>);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });

  it("keeps two same-tone badges distinguishable by text alone", () => {
    render(
      <>
        <Badge tone="warn">Stale snapshot</Badge>
        <Badge tone="warn">Delayed listener</Badge>
      </>,
    );
    expect(screen.getByText("Stale snapshot")).not.toBeNull();
    expect(screen.getByText("Delayed listener")).not.toBeNull();
  });

  it("can render without the tone dot while keeping its text", () => {
    const { container } = render(<Badge dot={false}>Manual</Badge>);
    expect(screen.getByText("Manual")).not.toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
