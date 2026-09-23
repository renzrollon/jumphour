// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders its visible children as the accessible name", () => {
    render(<Button>Compose idea</Button>);
    expect(screen.getByRole("button", { name: "Compose idea" })).not.toBeNull();
  });

  it("defaults to type=button so it never submits an enclosing form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("accepts an explicit type", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("type")).toBe("submit");
  });

  it("calls onClick when activated by mouse or keyboard", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Retry</Button>);
    const button = screen.getByRole("button", { name: "Retry" });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("is not operable while disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Retry
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
