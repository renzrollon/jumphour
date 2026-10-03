// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./text-field";

afterEach(() => {
  cleanup();
});

describe("TextField", () => {
  it("associates its visible label with the input", () => {
    render(<TextField label="Title" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Title")).not.toBeNull();
  });

  it("keeps the label in the accessibility tree, only visually hidden, when hideLabel is set", () => {
    render(<TextField label="Repository scope" hideLabel value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Repository scope")).not.toBeNull();
  });

  it("renders its error as an alert wired to the input by aria-describedby", () => {
    render(
      <TextField
        label="Title"
        value=""
        onChange={() => {}}
        error="Add a title so the idea is recognizable on the board."
      />,
    );
    const input = screen.getByLabelText("Title");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Add a title so the idea is recognizable on the board.");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders no alert and no aria-invalid when there is no error", () => {
    render(<TextField label="Title" value="" onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBeNull();
  });

  it("calls onChange as the viewer types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextField label="Title" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText("Title"), "a");
    expect(onChange).toHaveBeenCalled();
  });
});
