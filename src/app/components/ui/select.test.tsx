// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./select";

afterEach(() => {
  cleanup();
});

const REPO_OPTIONS = [
  { value: "all", label: "All repositories" },
  { value: "acme/api-gateway", label: "acme/api-gateway" },
];

describe("Select", () => {
  it("associates its visible label with the select and renders every option", () => {
    render(<Select label="Repository scope" value="all" options={REPO_OPTIONS} onChange={() => {}} />);
    const select = screen.getByLabelText("Repository scope") as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[1]?.textContent).toBe("acme/api-gateway");
  });

  it("keeps the label in the accessibility tree, only visually hidden, when hideLabel is set", () => {
    render(<Select label="Source filter" hideLabel value="all" options={REPO_OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText("Source filter")).not.toBeNull();
  });

  it("calls onChange with the selected value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Select label="Repository scope" value="all" options={REPO_OPTIONS} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText("Repository scope"), "acme/api-gateway");
    expect(onChange).toHaveBeenCalledWith("acme/api-gateway", expect.anything());
  });
});
