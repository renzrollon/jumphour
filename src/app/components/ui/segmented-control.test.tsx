// @vitest-environment jsdom
// Task 5.4: SegmentedControl is a roving-tabindex radiogroup.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";

afterEach(() => {
  cleanup();
});

type Theme = "system" | "light" | "dark";
const OPTIONS: SegmentedOption<Theme>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Harness({ initial, onChange }: { initial: string; onChange?: (value: Theme) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button">before</button>
      <SegmentedControl
        label="Theme"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          onChange?.(next);
          setValue(next);
        }}
      />
      <button type="button">after</button>
    </>
  );
}

function radios() {
  return screen.getAllByRole("radio");
}

function checkedNames() {
  return radios()
    .filter((radio) => radio.getAttribute("aria-checked") === "true")
    .map((radio) => radio.textContent);
}

function tabStops() {
  return radios().filter((radio) => radio.tabIndex === 0);
}

describe("SegmentedControl", () => {
  it("is a labelled radiogroup with one tab stop and exactly one checked option", () => {
    render(<Harness initial="light" />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(radios()).toHaveLength(3);
    expect(checkedNames()).toEqual(["Light"]);
    expect(tabStops().map((radio) => radio.textContent)).toEqual(["Light"]);
    expect(radios().filter((radio) => radio.tabIndex === -1)).toHaveLength(2);
  });

  it("tabs onto the checked option, and arrow keys move focus and the choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="light" onChange={onChange} />);

    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Light" }));

    await user.keyboard("{ArrowRight}");
    const dark = screen.getByRole("radio", { name: "Dark" });
    expect(document.activeElement).toBe(dark);
    expect(checkedNames()).toEqual(["Dark"]);
    expect(onChange).toHaveBeenLastCalledWith("dark");

    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Light" }));
    expect(checkedNames()).toEqual(["Light"]);

    await user.keyboard("{ArrowDown}");
    expect(checkedNames()).toEqual(["Dark"]);
    expect(tabStops()).toEqual([dark]);
  });

  it("wraps from the last option to the first and from the first to the last", async () => {
    const user = userEvent.setup();
    render(<Harness initial="dark" />);

    screen.getByRole("radio", { name: "Dark" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "System" }));
    expect(checkedNames()).toEqual(["System"]);

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Dark" }));
    expect(checkedNames()).toEqual(["Dark"]);
  });

  it("lets Tab leave the group entirely, and Shift+Tab re-enter on the checked option", async () => {
    const user = userEvent.setup();
    render(<Harness initial="dark" />);

    screen.getByRole("radio", { name: "Dark" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "after" }));

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "System" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "before" }));
  });

  it("with an unrecognized value, focus lands on the first option and an arrow key makes a choice", async () => {
    const user = userEvent.setup();
    render(<Harness initial="sepia" />);

    expect(checkedNames()).toEqual([]);
    expect(tabStops().map((radio) => radio.textContent)).toEqual(["System"]);

    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "System" }));

    await user.keyboard("{ArrowRight}");
    expect(checkedNames()).toEqual(["Light"]);
    expect(tabStops().map((radio) => radio.textContent)).toEqual(["Light"]);
  });

  it("with an unrecognized value, activating the focused first option makes a choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);

    screen.getByRole("button", { name: "before" }).focus();
    await user.tab();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("system");
    expect(checkedNames()).toEqual(["System"]);
  });

  it("chooses an option on click and does not re-report the current choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="light" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "System" }));
    expect(onChange).toHaveBeenCalledWith("system");
    expect(checkedNames()).toEqual(["System"]);
  });

  it("keeps the accessible name when the visible label differs", () => {
    render(
      <SegmentedControl
        label="Theme"
        options={[
          { value: "light", label: "Sunbeam", accessibleName: "Light" },
          { value: "dark", label: "Night prowl", accessibleName: "Dark" },
        ]}
        value="light"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "Light" }).textContent).toBe("Sunbeam");
    expect(screen.getByRole("radio", { name: "Dark" }).getAttribute("aria-checked")).toBe("false");
  });
});
