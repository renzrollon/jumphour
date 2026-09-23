// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";

afterEach(() => {
  cleanup();
});

describe("Switch", () => {
  it("exposes role=switch with its visible label as the accessible name", () => {
    render(
      <Switch checked={false} onChange={() => {}}>
        Cats
      </Switch>,
    );
    const el = screen.getByRole("switch", { name: "Cats" });
    expect(el.getAttribute("aria-checked")).toBe("false");
  });

  it("reflects checked=true in aria-checked", () => {
    render(
      <Switch checked onChange={() => {}}>
        Cats
      </Switch>,
    );
    expect(screen.getByRole("switch", { name: "Cats" }).getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange with the flipped value on mouse and keyboard activation", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Switch checked={false} onChange={onChange}>
        Cats
      </Switch>,
    );
    const el = screen.getByRole("switch", { name: "Cats" });
    await user.click(el);
    expect(onChange).toHaveBeenLastCalledWith(true);
    el.focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("hides its track and knob visuals from assistive technology", () => {
    const { container } = render(
      <Switch checked={false} onChange={() => {}}>
        Cats
      </Switch>,
    );
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    // track + knob
    expect(hidden.length).toBe(2);
  });
});
