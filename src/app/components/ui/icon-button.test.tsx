// @vitest-environment jsdom
// Task 5.5: "verify tests that IconButton cannot be constructed without an
// accessible name (type-level requirement plus a rendered-name assertion)".
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconButton } from "./icon-button";
import { CloseIcon, SettingsIcon } from "./icon";

afterEach(() => {
  cleanup();
});

describe("IconButton", () => {
  it("announces its aria-label as the accessible name (rendered-name assertion)", () => {
    render(<IconButton icon={<SettingsIcon />} aria-label="Settings" />);
    expect(screen.getByRole("button", { name: "Settings" })).not.toBeNull();
  });

  it("hides its icon from assistive technology so the label is the only name source", () => {
    const { container } = render(<IconButton icon={<CloseIcon />} aria-label="Dismiss" />);
    const button = screen.getByRole("button", { name: "Dismiss" });
    const wrapper = button.firstElementChild;
    expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    // No visible text content competes with the aria-label as the name.
    expect(button.textContent?.trim()).toBe("");
  });

  it("defaults to type=button and calls onClick when activated", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IconButton icon={<CloseIcon />} aria-label="Dismiss" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Dismiss" });
    expect(button.getAttribute("type")).toBe("button");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the outline variant by default and accepts ghost", () => {
    const { rerender } = render(<IconButton icon={<CloseIcon />} aria-label="Dismiss" />);
    expect(screen.getByRole("button", { name: "Dismiss" }).className).toContain("outline");
    rerender(<IconButton icon={<CloseIcon />} aria-label="Dismiss" variant="ghost" />);
    expect(screen.getByRole("button", { name: "Dismiss" }).className).toContain("ghost");
  });
});

// Type-level requirement: omitting `aria-label` must fail to compile, not
// merely fail at runtime. This function is never called — `npm run
// typecheck` (tsc --noEmit) is what proves the guarantee, by requiring the
// `@ts-expect-error` below to actually be suppressing an error. If
// IconButtonProps ever makes `aria-label` optional, this directive becomes
// unused and typecheck fails.
function _iconButtonRequiresAnAccessibleNameAtCompileTime() {
  // @ts-expect-error IconButton requires `aria-label`; omitting it must not type-check.
  return <IconButton icon={<CloseIcon />} />;
}
void _iconButtonRequiresAnAccessibleNameAtCompileTime;
