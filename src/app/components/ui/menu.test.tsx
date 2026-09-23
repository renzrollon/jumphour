// @vitest-environment jsdom
// Task 5.3: Popover and Menu on the shared overlay core.
// specs/design-system/spec.md "Dismiss and navigate menus and popovers from
// the keyboard": the invoker is marked expanded; Escape and an outside click
// each dismiss (the outside click activating nothing and changing nothing);
// Escape restores focus to the invoker; Up/Down move with wrapping and
// Home/End jump to the ends; Enter activates and closes; opening a second
// transient surface closes the first; and Escape inside a menu nested in a
// dialog closes only the menu.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, type MenuItem } from "./menu";
import { Popover } from "./popover";
import { Dialog } from "./dialog";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.body.replaceChildren();
});

const button = (name: string | RegExp) => screen.getByRole("button", { name, hidden: true });
const item = (name: string) => screen.getByRole("menuitem", { name, hidden: true });
const active = () => document.activeElement;

function makeItems(onSelect: (id: string) => void, overrides: Partial<Record<string, Partial<MenuItem>>> = {}) {
  return ["Copy link", "Open source", "Hide from board", "Archive"].map((label) => ({
    id: label,
    label,
    onSelect: () => onSelect(label),
    ...overrides[label],
  }));
}

function LoadMenu({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
  return (
    <Menu
      label="Card actions"
      items={makeItems(onSelect)}
      renderTrigger={(props) => <button {...props}>More actions</button>}
    />
  );
}

describe("Menu", () => {
  it("marks its trigger expanded while open and points it at the menu", async () => {
    const user = userEvent.setup();
    render(<LoadMenu />);
    const trigger = button("More actions");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.hasAttribute("aria-controls")).toBe(false);

    await user.click(trigger);
    const menu = screen.getByRole("menu", { name: "Card actions" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(active()).toBe(item("Copy link"));

    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("moves with Down twice, End, Home, then Enter activates the focused item and closes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LoadMenu onSelect={onSelect} />);
    await user.click(button("More actions"));
    expect(active()).toBe(item("Copy link"));

    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(item("Open source"));
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(item("Hide from board"));
    await user.keyboard("{End}");
    expect(active()).toBe(item("Archive"));
    await user.keyboard("{Home}");
    expect(active()).toBe(item("Copy link"));
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Copy link");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(active()).toBe(button("More actions"));
    expect(button("More actions").getAttribute("aria-expanded")).toBe("false");
  });

  it("wraps Up from the first item to the last and Down from the last to the first", async () => {
    const user = userEvent.setup();
    render(<LoadMenu />);
    await user.click(button("More actions"));
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe(item("Archive"));
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(item("Copy link"));
  });

  it("skips and never activates a disabled item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu
        label="Card actions"
        items={makeItems(onSelect, { "Open source": { disabled: true } })}
        renderTrigger={(props) => <button {...props}>More actions</button>}
      />,
    );
    await user.click(button("More actions"));
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(item("Hide from board"));
    await user.click(item("Open source"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).not.toBeNull();
  });

  it("opens on the first item with ArrowDown and on the last with ArrowUp from the trigger", async () => {
    const user = userEvent.setup();
    render(<LoadMenu />);
    button("More actions").focus();
    await user.keyboard("{ArrowDown}");
    expect(active()).toBe(item("Copy link"));
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowUp}");
    expect(active()).toBe(item("Archive"));
  });

  it("closes on Escape without activating anything and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<LoadMenu onSelect={onSelect} />);
    await user.click(button("More actions"));
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(active()).toBe(button("More actions"));
    expect(button("More actions").getAttribute("aria-expanded")).toBe("false");
  });

  it("dismisses on an outside click without activating an item or changing anything", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    function Page() {
      const [hidden, setHidden] = useState<string[]>([]);
      return (
        <>
          <p data-testid="outside">Board</p>
          <output data-testid="state">{hidden.join(",") || "none"}</output>
          <Menu
            label="Card actions"
            items={makeItems((id) => {
              onSelect(id);
              setHidden((was) => [...was, id]);
            })}
            renderTrigger={(props) => <button {...props}>More actions</button>}
          />
        </>
      );
    }
    render(<Page />);
    await user.click(button("More actions"));
    await user.keyboard("{ArrowDown}");
    await user.click(screen.getByTestId("outside"));

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("none");
    expect(button("More actions").getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when a second transient surface opens, leaving only one open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <LoadMenu />
        <Popover label="Derived lifecycle" renderTrigger={(props) => <button {...props}>Legend</button>}>
          <p>Lanes are derived.</p>
        </Popover>
      </>,
    );
    await user.click(button("More actions"));
    expect(screen.getByRole("menu")).not.toBeNull();

    await user.click(button("Legend"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button("More actions").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("dialog", { name: "Derived lifecycle" })).not.toBeNull();
    expect(button("Legend").getAttribute("aria-expanded")).toBe("true");
  });

  it("closes the other surface when one opens from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover label="Derived lifecycle" renderTrigger={(props) => <button {...props}>Legend</button>}>
          <p>Lanes are derived.</p>
        </Popover>
        <LoadMenu />
      </>,
    );
    await user.click(button("Legend"));
    expect(screen.getByRole("dialog", { name: "Derived lifecycle" })).not.toBeNull();
    button("More actions").focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.queryByRole("dialog", { name: "Derived lifecycle", hidden: true })).toBeNull();
    expect(screen.getByRole("menu")).not.toBeNull();
    expect(active()).toBe(item("Copy link"));
  });

  it("inside a dialog, Escape closes only the menu; the next Escape closes the dialog", async () => {
    const user = userEvent.setup();
    const onDialogClose = vi.fn();
    function Page() {
      const [open, setOpen] = useState(false);
      const invokerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={invokerRef} type="button" onClick={() => setOpen(true)}>
            Promote
          </button>
          <Dialog
            open={open}
            title="Promote to OpenSpec"
            invokerRef={invokerRef}
            onClose={() => {
              onDialogClose();
              setOpen(false);
            }}
          >
            <LoadMenu />
          </Dialog>
        </>
      );
    }
    render(<Page />);
    await user.click(button("Promote"));
    await user.click(button("More actions"));
    expect(screen.getByRole("menu")).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onDialogClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Promote to OpenSpec" })).not.toBeNull();
    expect(active()).toBe(button("More actions"));

    await user.keyboard("{Escape}");
    expect(onDialogClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Promote"));
  });

  it("supports a controlled open state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Menu
        label="Card actions"
        open={false}
        onOpenChange={onOpenChange}
        items={makeItems(() => {})}
        renderTrigger={(props) => <button {...props}>More actions</button>}
      />,
    );
    await user.click(button("More actions"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("menu")).toBeNull();
    rerender(
      <Menu
        label="Card actions"
        open
        onOpenChange={onOpenChange}
        items={makeItems(() => {})}
        renderTrigger={(props) => <button {...props}>More actions</button>}
      />,
    );
    expect(screen.getByRole("menu")).not.toBeNull();
  });
});

describe("Popover", () => {
  function Legend({ onInside = () => {} }: { onInside?: () => void }) {
    return (
      <>
        <p data-testid="outside">Board</p>
        <Popover label="Derived lifecycle" renderTrigger={(props) => <button {...props}>Legend</button>}>
          <p>Lanes are derived.</p>
          <button type="button" onClick={onInside}>
            Learn more
          </button>
        </Popover>
      </>
    );
  }

  it("marks its trigger expanded, labels its surface, and moves focus into it", async () => {
    const user = userEvent.setup();
    render(<Legend />);
    const trigger = button("Legend");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");

    await user.click(trigger);
    const surface = screen.getByRole("dialog", { name: "Derived lifecycle" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(surface.id);
    expect(surface.hasAttribute("aria-modal")).toBe(false);
    expect(active()).toBe(button("Learn more"));
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Legend />);
    await user.click(button("Legend"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()).toBe(button("Legend"));
    expect(button("Legend").getAttribute("aria-expanded")).toBe("false");
  });

  it("dismisses on an outside click without activating anything inside it", async () => {
    const user = userEvent.setup();
    const onInside = vi.fn();
    render(<Legend onInside={onInside} />);
    await user.click(button("Legend"));
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onInside).not.toHaveBeenCalled();
    expect(button("Legend").getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the background reachable, since it is not modal", async () => {
    const user = userEvent.setup();
    render(<Legend />);
    await user.click(button("Legend"));
    expect(document.querySelector("[inert]")).toBeNull();
    expect(screen.getByTestId("outside").closest("[aria-hidden='true']")).toBeNull();
  });
});
