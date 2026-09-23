// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Illustration } from "./illustration";

afterEach(() => {
  cleanup();
});

describe("Illustration", () => {
  it("hides decorative content from assistive technology regardless of what markup it wraps", () => {
    const { container } = render(
      <Illustration>
        <img src="cat.svg" alt="A cat curled around a laptop" />
        <span title="decorative flourish">*</span>
      </Illustration>,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders its children visually inside the hidden wrapper", () => {
    const { container } = render(
      <Illustration>
        <svg data-testid="art" />
      </Illustration>,
    );
    expect(container.querySelector('[data-testid="art"]')).not.toBeNull();
  });
});
