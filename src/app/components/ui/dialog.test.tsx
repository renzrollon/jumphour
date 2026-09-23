// @vitest-environment jsdom
// Task 5.2: Dialog (centered) and Sheet (right side) on the shared overlay
// core. specs/design-system/spec.md "Trap, dismiss, and restore focus for
// modal overlays": focus enters on open, Tab and Shift+Tab wrap inside, the
// background is unreachable, Escape closes and restores focus to the invoker,
// Escape is refused while closeGuard is set and the working state stays
// visible, and a removed invoker restores focus to the nearest surviving
// container rather than the document body.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState, type ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";
import { Sheet } from "./sheet";
import type { ModalProps } from "./modal";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.body.replaceChildren();
});

const primitives: Array<[string, ComponentType<ModalProps>]> = [
  ["Dialog", Dialog],
  ["Sheet", Sheet],
];

const button = (name: string | RegExp) => screen.getByRole("button", { name, hidden: true });
const active = () => document.activeElement;

describe.each(primitives)("%s", (_name, Modal) => {
  function Harness({ closeGuard = false, onClose }: { closeGuard?: boolean; onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    const invokerRef = useRef<HTMLButtonElement>(null);
    return (
      <main>
        <button type="button">Before</button>
        <button ref={invokerRef} type="button" onClick={() => setOpen(true)}>
          Compose idea
        </button>
        <a href="#after">After</a>
        <Modal
          open={open}
          title="Compose idea"
          description="Capture a decision-worthy idea."
          invokerRef={invokerRef}
          closeGuard={closeGuard}
          busyMessage="Creating the OpenSpec change…"
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          footer={<button type="button">Save</button>}
        >
          <label>
            Title <input />
          </label>
        </Modal>
      </main>
    );
  }

  it("renders a labelled, described modal surface and moves focus into it on open", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Compose idea"));

    const surface = screen.getByRole("dialog", { name: "Compose idea" });
    expect(surface.getAttribute("aria-modal")).toBe("true");
    expect(surface.getAttribute("tabindex")).toBe("-1");
    expect(surface.getAttribute("aria-describedby")).not.toBeNull();
    expect(document.getElementById(surface.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Capture a decision-worthy idea.",
    );
    expect(surface.contains(active())).toBe(true);
  });

  it("wraps Tab and Shift+Tab inside the surface", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Compose idea"));

    const close = button("Close");
    const input = screen.getByRole("textbox", { hidden: true });
    const save = button("Save");
    expect(active()).toBe(close);

    await user.tab();
    expect(active()).toBe(input);
    await user.tab();
    expect(active()).toBe(save);
    await user.tab();
    expect(active()).toBe(close);
    await user.tab({ shift: true });
    expect(active()).toBe(save);
  });

  it("makes the content behind it unreachable to pointer and assistive technology", async () => {
    const user = userEvent.setup();
    const behind = vi.fn();
    const { container } = render(
      <>
        <Harness />
        <button type="button" onClick={behind}>
          Behind
        </button>
      </>,
    );
    await user.click(button("Compose idea"));

    // The page content (the render container) is hidden and inert.
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.hasAttribute("inert")).toBe(true);
    // Only the overlay's own controls are exposed to assistive technology.
    expect(screen.queryByRole("button", { name: "Before" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).not.toBeNull();

    // A pointer press behind the overlay activates nothing and leaves it open.
    await user.click(button("Behind"));
    expect(behind).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Compose idea" })).not.toBeNull();
    expect(screen.getByRole("dialog", { name: "Compose idea" }).contains(active())).toBe(true);
  });

  it("closes on Escape, restores focus to the invoker, and releases the background", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(button("Compose idea"));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Compose idea"));
    expect(document.querySelector("[aria-hidden]")).toBeNull();
  });

  it("closes from its close button and restores focus to the invoker", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Compose idea"));
    await user.click(button("Close"));

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Compose idea"));
  });

  it("refuses Escape while closeGuard is set and keeps stating that work is running", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness closeGuard onClose={onClose} />);
    await user.click(button("Compose idea"));

    const surface = screen.getByRole("dialog", { name: "Compose idea" });
    const status = screen.getByRole("status");
    expect(surface.contains(status)).toBe(true);
    expect(status.textContent).toContain("Creating the OpenSpec change…");
    expect(surface.getAttribute("aria-busy")).toBe("true");

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Compose idea" })).toBe(surface);
    expect(status.textContent).toContain("Creating the OpenSpec change…");
    // The refusal is stated, not silent.
    expect(status.textContent).toContain("closed once this finishes");
    expect(surface.contains(active())).toBe(true);

    // The close button is refused the same way while work is in flight.
    const close = button("Close");
    expect(close.getAttribute("aria-disabled")).toBe("true");
    await user.click(close);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Compose idea" })).toBe(surface);
  });

  it("closes normally once the guard lifts", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness closeGuard />);
    await user.click(button("Compose idea"));
    rerender(<Harness closeGuard={false} />);

    expect(screen.getByRole("status").textContent).toBe("");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Compose idea"));
  });

  it("restores focus to the nearest surviving container when the invoker is removed", async () => {
    function RowHarness() {
      const [open, setOpen] = useState(false);
      const [rowPresent, setRowPresent] = useState(true);
      const invokerRef = useRef<HTMLButtonElement>(null);
      return (
        <main>
          <section aria-label="Ideas">
            <ul>
              {rowPresent ? (
                <li>
                  <button ref={invokerRef} type="button" onClick={() => setOpen(true)}>
                    Delete idea
                  </button>
                </li>
              ) : null}
            </ul>
          </section>
          <Modal open={open} title="Delete idea" invokerRef={invokerRef} onClose={() => setOpen(false)}>
            <button
              type="button"
              onClick={() => {
                setRowPresent(false);
                setOpen(false);
              }}
            >
              Confirm delete
            </button>
          </Modal>
        </main>
      );
    }

    const user = userEvent.setup();
    render(<RowHarness />);
    await user.click(button("Delete idea"));
    await user.click(button("Confirm delete"));
    await Promise.resolve();

    expect(screen.queryByRole("button", { name: "Delete idea", hidden: true })).toBeNull();
    expect(active()).not.toBe(document.body);
    expect(active()).toBe(document.querySelector("ul"));
    expect(document.querySelector("section")!.contains(active())).toBe(true);
  });
});

describe("Sheet placement", () => {
  it("renders the same modal semantics as Dialog with its own panel class", async () => {
    const user = userEvent.setup();
    function Both() {
      const [which, setWhich] = useState<"dialog" | "sheet" | null>(null);
      return (
        <>
          <button type="button" onClick={() => setWhich("dialog")}>
            Open dialog
          </button>
          <button type="button" onClick={() => setWhich("sheet")}>
            Open sheet
          </button>
          <Dialog open={which === "dialog"} title="D" onClose={() => setWhich(null)} />
          <Sheet open={which === "sheet"} title="S" onClose={() => setWhich(null)} />
        </>
      );
    }
    render(<Both />);
    await user.click(button("Open dialog"));
    const dialogClass = screen.getByRole("dialog", { name: "D" }).className;
    await user.keyboard("{Escape}");
    await user.click(button("Open sheet"));
    const sheetClass = screen.getByRole("dialog", { name: "S" }).className;
    expect(dialogClass).toContain("dialog");
    expect(sheetClass).toContain("sheet");
    expect(sheetClass).not.toBe(dialogClass);
  });
});
