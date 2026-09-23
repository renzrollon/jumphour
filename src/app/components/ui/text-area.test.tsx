// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextArea } from "./text-area";

afterEach(() => {
  cleanup();
});

describe("TextArea", () => {
  it("associates its visible label with the textarea", () => {
    render(<TextArea label="Problem / opportunity" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Problem / opportunity")).not.toBeNull();
  });

  it("defaults to 3 rows and accepts an override", () => {
    render(<TextArea label="Context" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Context").getAttribute("rows")).toBe("3");
  });

  it("renders its error as an alert wired to the textarea by aria-describedby", () => {
    render(<TextArea label="Context" value="" onChange={() => {}} error="Add supporting context." />);
    const textarea = screen.getByLabelText("Context");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Add supporting context.");
    expect(textarea.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("calls onChange as the viewer types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextArea label="Context" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText("Context"), "a");
    expect(onChange).toHaveBeenCalled();
  });
});
