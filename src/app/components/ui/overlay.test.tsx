// @vitest-environment jsdom
// Task 5.1: the shared overlay core, tested directly through useOverlay with a
// bare harness surface, before Dialog, Sheet, Popover, or Menu wrap it.
// Behaviors: focus on open, focus trap, focus restoration (including a removed
// invoker), Escape with closeGuard, outside-press dismissal, background
// isolation, scroll lock, innermost-first Escape, one transient at a time.
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOverlay, type DismissReason, type OverlayKind, type OverlayOptions } from "./overlay";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.body.replaceChildren();
});

type SurfaceProps = Omit<OverlayOptions, "surfaceRef"> & { label: string; children?: ReactNode };

/** A bare surface: the smallest markup the core needs, portaled like a real overlay. */
function Surface({ label, children, ...options }: SurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  useOverlay({ ...options, surfaceRef });
  if (!options.open) return null;
  return createPortal(
    <div ref={surfaceRef} role={options.kind === "modal" ? "dialog" : "group"} aria-label={label} tabIndex={-1}>
      {children}
    </div>,
    document.body,
  );
}

interface OpenerProps {
  label: string;
  kind: OverlayKind;
  children?: ReactNode;
  closeGuard?: boolean;
  onDismissSpy?: (reason: DismissReason) => void;
  onDismissRefused?: (reason: DismissReason) => void;
}

/** A trigger plus its surface; the surface closes whenever the core asks. */
function Opener({ label, kind, children, closeGuard, onDismissSpy, onDismissRefused }: OpenerProps) {
  const [open, setOpen] = useState(false);
  const invokerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={invokerRef} type="button" onClick={() => setOpen((was) => !was)}>
        Open {label}
      </button>
      <Surface
        label={label}
        kind={kind}
        open={open}
        closeGuard={closeGuard}
        invokerRef={invokerRef}
        onDismissRefused={onDismissRefused}
        onDismiss={(reason) => {
          onDismissSpy?.(reason);
          setOpen(false);
        }}
      >
        {children}
      </Surface>
    </>
  );
}

const surface = (name: string): HTMLElement => {
  const found = document.body.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"], [role="group"][aria-label="${name}"]`);
  if (!found) throw new Error(`no open surface named ${name}`);
  return found;
};
const button = (name: string) => screen.getByRole("button", { name, hidden: true });
const active = () => document.activeElement;

describe("focus on open", () => {
  it("moves focus to the first tabbable element inside the surface", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Dialog" kind="modal">
        <p>Heading copy</p>
        <button type="button">First</button>
        <button type="button">Second</button>
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    expect(active()).toBe(button("First"));
  });

  it("honors initialFocusRef", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const target = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Surface label="Dialog" kind="modal" open={open} onDismiss={() => setOpen(false)} initialFocusRef={target}>
            <button type="button">First</button>
            <button ref={target} type="button">Second</button>
          </Surface>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Open"));
    expect(active()).toBe(button("Second"));
  });

  it("focuses the surface itself when nothing inside is tabbable", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Dialog" kind="modal">
        <p>Nothing to press</p>
        <button type="button" disabled>Disabled</button>
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    expect(active()).toBe(surface("Dialog"));
  });

  it("leaves focus on the invoker when autoFocus is false", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Surface label="Tip" kind="transient" open={open} autoFocus={false} onDismiss={() => setOpen(false)}>
            <button type="button">Inside</button>
          </Surface>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Open"));
    expect(surface("Tip")).toBeTruthy();
    expect(active()).toBe(button("Open"));
  });
});

describe("focus trap for modal surfaces", () => {
  function renderThreeButtonDialog() {
    return render(
      <>
        <button type="button">Before</button>
        <Opener label="Dialog" kind="modal">
          <button type="button">First</button>
          <button type="button" tabIndex={-1}>Skipped by Tab</button>
          <button type="button" disabled>Disabled</button>
          <span hidden>
            <button type="button">Hidden</button>
          </span>
          <button type="button">Second</button>
          <a href="https://example.test/docs">Third</a>
        </Opener>
        <button type="button">After</button>
      </>,
    );
  }

  it("wraps Tab from the last stop to the first and Shift+Tab from the first to the last", async () => {
    const user = userEvent.setup();
    renderThreeButtonDialog();
    await user.click(button("Open Dialog"));
    expect(active()).toBe(button("First"));

    await user.tab();
    expect(active()).toBe(button("Second"));
    await user.tab();
    expect(active()).toBe(screen.getByRole("link", { name: "Third", hidden: true }));
    await user.tab();
    expect(active()).toBe(button("First"));

    await user.tab({ shift: true });
    expect(active()).toBe(screen.getByRole("link", { name: "Third", hidden: true }));
    await user.tab({ shift: true });
    expect(active()).toBe(button("Second"));
  });

  it("continues in document order from the surface itself or an untabbable element", async () => {
    const user = userEvent.setup();
    renderThreeButtonDialog();
    await user.click(button("Open Dialog"));

    act(() => surface("Dialog").focus());
    await user.tab();
    expect(active()).toBe(button("First"));

    act(() => button("Skipped by Tab").focus());
    await user.tab();
    expect(active()).toBe(button("Second"));
    act(() => button("Skipped by Tab").focus());
    await user.tab({ shift: true });
    expect(active()).toBe(button("First"));
  });

  it("keeps Tab on the surface when it has no tabbable content", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Dialog" kind="modal">
        <p>Read only</p>
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    await user.tab();
    expect(active()).toBe(surface("Dialog"));
    await user.tab({ shift: true });
    expect(active()).toBe(surface("Dialog"));
  });

  it("pulls focus back inside when something outside is focused while it is open", async () => {
    const user = userEvent.setup();
    renderThreeButtonDialog();
    await user.click(button("Open Dialog"));
    await user.tab();
    expect(active()).toBe(button("Second"));

    act(() => button("After").focus());
    expect(active()).toBe(button("Second"));
  });

  it("does not trap a transient surface", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Popover" kind="transient">
        <button type="button">Only</button>
      </Opener>,
    );
    await user.click(button("Open Popover"));
    expect(active()).toBe(button("Only"));
    await user.tab();
    expect(surface("Popover").contains(active())).toBe(false);
    expect(surface("Popover")).toBeTruthy();
  });
});

describe("focus restoration", () => {
  it("returns focus to the invoking control when Escape closes the surface", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Dialog" kind="modal">
        <button type="button">Inside</button>
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    expect(active()).toBe(button("Inside"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Open Dialog"));
  });

  it("uses the control that held focus when no invokerRef is given", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Surface label="Dialog" kind="modal" open={open} onDismiss={() => setOpen(false)}>
            <button type="button">Inside</button>
          </Surface>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Open"));
    await user.keyboard("{Escape}");
    expect(active()).toBe(button("Open"));
  });

  function RemovableInvoker({ closeWithRemoval, surfaceFirst = false }: { closeWithRemoval: boolean; surfaceFirst?: boolean }) {
    const [open, setOpen] = useState(false);
    const [invokerPresent, setInvokerPresent] = useState(true);
    const dialog = (
      <Surface label="Dialog" kind="modal" open={open} onDismiss={() => setOpen(false)}>
        <button
          type="button"
          onClick={() => {
            setInvokerPresent(false);
            if (closeWithRemoval) setOpen(false);
          }}
        >
          Archive card
        </button>
      </Surface>
    );
    return (
      <>
        {surfaceFirst ? dialog : null}
        <section aria-label="Lane">
          <button type="button">Lane action</button>
          <div data-testid="card-slot">
            {invokerPresent ? (
              <button type="button" onClick={() => setOpen(true)}>Open card</button>
            ) : null}
          </div>
        </section>
        {surfaceFirst ? null : dialog}
      </>
    );
  }

  it("moves focus to the nearest surviving region when the invoker was removed while open", async () => {
    const user = userEvent.setup();
    render(<RemovableInvoker closeWithRemoval={false} />);
    await user.click(button("Open card"));
    await user.click(button("Archive card"));
    await user.keyboard("{Escape}");

    const slot = screen.getByTestId("card-slot");
    expect(active()).toBe(slot);
    expect(active()).not.toBe(document.body);
    // The region is focusable only for this landing; it is not a lasting tab stop.
    expect(slot.getAttribute("tabindex")).toBe("-1");
    await user.tab();
    expect(slot.hasAttribute("tabindex")).toBe(false);
  });

  it.each([
    ["removed before the surface lets go", false],
    ["removed after the surface already restored focus to it", true],
  ])("recovers when the invoker is removed in the same update that closes the surface (%s)", async (_, surfaceFirst) => {
    const user = userEvent.setup();
    render(<RemovableInvoker closeWithRemoval surfaceFirst={surfaceFirst} />);
    await user.click(button("Open card"));
    await user.click(button("Archive card"));
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(screen.getByTestId("card-slot"));
  });

  it("falls back to the invoker of the surface the invoker lived in", async () => {
    function Harness() {
      const [popoverOpen, setPopoverOpen] = useState(false);
      const [dialogOpen, setDialogOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={trigger} type="button" onClick={() => setPopoverOpen(true)}>Settings</button>
          <Surface label="Popover" kind="transient" open={popoverOpen} invokerRef={trigger} onDismiss={() => setPopoverOpen(false)}>
            <button type="button" onClick={() => setDialogOpen(true)}>Edit source</button>
          </Surface>
          <Surface label="Dialog" kind="modal" open={dialogOpen} onDismiss={() => setDialogOpen(false)}>
            <button type="button" onClick={() => setPopoverOpen(false)}>Save</button>
          </Surface>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Settings"));
    await user.click(button("Edit source"));
    await user.click(button("Save"));
    expect(screen.queryByRole("group", { name: "Popover", hidden: true })).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Settings"));
  });

  it("lets focus follow an outside press instead of pulling it back to the invoker", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onElsewhere = vi.fn();
    render(
      <>
        <Opener label="Popover" kind="transient" onDismissSpy={onDismiss}>
          <button type="button">Inside</button>
        </Opener>
        <button type="button" onClick={onElsewhere}>Elsewhere</button>
      </>,
    );
    await user.click(button("Open Popover"));
    expect(active()).toBe(button("Inside"));

    await user.click(button("Elsewhere"));
    expect(onDismiss).toHaveBeenCalledWith("outside");
    expect(screen.queryByRole("group", { name: "Popover" })).toBeNull();
    expect(active()).toBe(button("Elsewhere"));
    expect(onElsewhere).toHaveBeenCalledTimes(1);
  });

  it("does not pull focus back to the invoker for an outside press that moves focus nowhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Opener label="Popover" kind="transient">
          <button type="button">Inside</button>
        </Opener>
        <p>Page copy</p>
      </>,
    );
    await user.click(button("Open Popover"));
    expect(active()).toBe(button("Inside"));

    // A bare press, as when a touch starts a scroll: no mousedown follows to move focus.
    fireEvent.pointerDown(screen.getByText("Page copy"));
    expect(screen.queryByRole("group", { name: "Popover" })).toBeNull();
    expect(active()).not.toBe(button("Open Popover"));
  });
});

describe("Escape and closeGuard", () => {
  it("closes on Escape and reports the reason", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Opener label="Dialog" kind="modal" onDismissSpy={onDismiss}><button type="button">Inside</button></Opener>);
    await user.click(button("Open Dialog"));
    await user.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledWith("escape");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("refuses Escape while closeGuard is set, says so, and closes once the guard lifts", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const [working, setWorking] = useState(false);
      const [refusals, setRefusals] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Launch</button>
          <Surface
            label="Launch sheet"
            kind="modal"
            open={open}
            closeGuard={working}
            onDismissRefused={() => setRefusals((n) => n + 1)}
            onDismiss={() => setOpen(false)}
          >
            <button type="button" onClick={() => setWorking((was) => !was)}>{working ? "Stop" : "Start"}</button>
            {working ? <p role="status">Session is running{refusals > 0 ? " — it cannot be closed yet" : ""}</p> : null}
          </Surface>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(button("Launch"));
    await user.click(button("Start"));

    await user.keyboard("{Escape}");
    expect(surface("Launch sheet")).toBeTruthy();
    expect(screen.getByRole("status", { hidden: true }).textContent).toBe(
      "Session is running — it cannot be closed yet",
    );
    expect(surface("Launch sheet").contains(active())).toBe(true);

    await user.click(button("Stop"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(active()).toBe(button("Launch"));
  });

  it("refuses an outside press on a guarded transient surface", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onRefused = vi.fn();
    render(
      <>
        <Opener label="Popover" kind="transient" closeGuard onDismissSpy={onDismiss} onDismissRefused={onRefused}>
          <button type="button">Inside</button>
        </Opener>
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(button("Open Popover"));
    await user.click(button("Elsewhere"));
    expect(onRefused).toHaveBeenCalledWith("outside");
    expect(onDismiss).not.toHaveBeenCalled();
    expect(surface("Popover")).toBeTruthy();
  });

  it("leaves an Escape that content inside already handled alone", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Opener label="Dialog" kind="modal" onDismissSpy={onDismiss}>
        <input
          aria-label="Search"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        />
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    expect(active()).toBe(screen.getByRole("textbox", { name: "Search", hidden: true }));
    await user.keyboard("{Escape}");
    expect(onDismiss).not.toHaveBeenCalled();
    expect(surface("Dialog")).toBeTruthy();
  });
});

describe("outside-press dismissal", () => {
  it("dismisses a transient surface on a press outside it, but not on a press inside", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <Opener label="Popover" kind="transient" onDismissSpy={onDismiss}>
          <p>Body copy</p>
          <button type="button">Inside</button>
        </Opener>
        <p>Page copy</p>
      </>,
    );
    await user.click(button("Open Popover"));
    await user.click(screen.getByText("Body copy"));
    await user.click(button("Inside"));
    expect(onDismiss).not.toHaveBeenCalled();

    await user.click(screen.getByText("Page copy"));
    expect(onDismiss).toHaveBeenCalledExactlyOnceWith("outside");
    expect(screen.queryByRole("group", { name: "Popover" })).toBeNull();
  });

  it("treats the invoker as inside, so pressing it toggles the surface closed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Opener label="Popover" kind="transient" onDismissSpy={onDismiss}><button type="button">Inside</button></Opener>);
    await user.click(button("Open Popover"));
    await user.click(button("Open Popover"));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Popover" })).toBeNull();
  });

  it("swallows presses outside a modal surface: nothing behind it activates and it stays open", async () => {
    const user = userEvent.setup();
    const onBehind = vi.fn();
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button" onPointerDown={onBehind} onMouseDown={onBehind} onClick={onBehind}>
          Behind
        </button>
        <Opener label="Dialog" kind="modal" onDismissSpy={onDismiss}>
          <button type="button">Inside</button>
        </Opener>
      </>,
    );
    await user.click(button("Open Dialog"));
    await user.click(button("Behind"));
    expect(onBehind).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(surface("Dialog")).toBeTruthy();
    expect(active()).toBe(button("Inside"));
  });
});

describe("background isolation for modal surfaces", () => {
  it("hides everything but the modal from pointer and assistive technology, then restores it exactly", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Opener label="Dialog" kind="modal">
        <button type="button">Inside</button>
      </Opener>,
    );
    const sibling = document.createElement("div");
    sibling.setAttribute("aria-hidden", "false");
    const live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    document.body.append(sibling, live);

    await user.click(button("Open Dialog"));
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(container.hasAttribute("inert")).toBe(true);
    expect(sibling.getAttribute("aria-hidden")).toBe("true");
    expect(live.hasAttribute("aria-hidden")).toBe(false);
    expect(surface("Dialog").hasAttribute("aria-hidden")).toBe(false);
    expect(surface("Dialog").hasAttribute("inert")).toBe(false);
    // Behind the modal, the invoker is out of the accessibility tree.
    expect(screen.queryByRole("button", { name: "Open Dialog" })).toBeNull();

    await user.keyboard("{Escape}");
    expect(container.hasAttribute("aria-hidden")).toBe(false);
    expect(container.hasAttribute("inert")).toBe(false);
    expect(sibling.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getByRole("button", { name: "Open Dialog" })).toBeTruthy();
  });

  it("does not isolate the page for a transient surface", async () => {
    const user = userEvent.setup();
    const { container } = render(<Opener label="Popover" kind="transient"><button type="button">Inside</button></Opener>);
    await user.click(button("Open Popover"));
    expect(container.hasAttribute("aria-hidden")).toBe(false);
    expect(container.hasAttribute("inert")).toBe(false);
  });
});

describe("scroll lock", () => {
  it("locks page scroll while a modal is open and restores the prior inline value", async () => {
    const user = userEvent.setup();
    document.documentElement.style.overflow = "auto";
    render(<Opener label="Dialog" kind="modal"><button type="button">Inside</button></Opener>);
    await user.click(button("Open Dialog"));
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe("auto");
  });

  it("stays locked until the last of two stacked modals closes", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Outer" kind="modal">
        <Opener label="Inner" kind="modal"><button type="button">Deep</button></Opener>
      </Opener>,
    );
    await user.click(button("Open Outer"));
    await user.click(button("Open Inner"));
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("does not lock scroll for a transient surface", async () => {
    const user = userEvent.setup();
    render(<Opener label="Popover" kind="transient"><button type="button">Inside</button></Opener>);
    await user.click(button("Open Popover"));
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("innermost-first Escape across the stack", () => {
  it("closes a transient surface inside a modal first, leaving the modal open", async () => {
    const user = userEvent.setup();
    const dialogDismiss = vi.fn();
    render(
      <Opener label="Dialog" kind="modal" onDismissSpy={dialogDismiss}>
        <Opener label="Menu" kind="transient"><button type="button">Item</button></Opener>
      </Opener>,
    );
    await user.click(button("Open Dialog"));
    await user.click(button("Open Menu"));
    expect(active()).toBe(button("Item"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Menu", hidden: true })).toBeNull();
    expect(surface("Dialog")).toBeTruthy();
    expect(dialogDismiss).not.toHaveBeenCalled();
    expect(active()).toBe(button("Open Menu"));

    await user.keyboard("{Escape}");
    expect(dialogDismiss).toHaveBeenCalledExactlyOnceWith("escape");
    expect(active()).toBe(button("Open Dialog"));
  });

  it("closes the inner of two stacked modals first and gives the outer back its content", async () => {
    const user = userEvent.setup();
    render(
      <Opener label="Outer" kind="modal">
        <Opener label="Inner" kind="modal"><button type="button">Deep</button></Opener>
      </Opener>,
    );
    await user.click(button("Open Outer"));
    await user.click(button("Open Inner"));
    expect(surface("Outer").getAttribute("aria-hidden")).toBe("true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Inner", hidden: true })).toBeNull();
    expect(surface("Outer").hasAttribute("aria-hidden")).toBe(false);
    expect(active()).toBe(button("Open Inner"));
  });

  it("lets a guarded inner surface consume Escape so the outer one never sees it", async () => {
    const user = userEvent.setup();
    const outerDismiss = vi.fn();
    const innerRefused = vi.fn();
    render(
      <Opener label="Outer" kind="modal" onDismissSpy={outerDismiss}>
        <Opener label="Inner" kind="modal" closeGuard onDismissRefused={innerRefused}>
          <button type="button">Deep</button>
        </Opener>
      </Opener>,
    );
    await user.click(button("Open Outer"));
    await user.click(button("Open Inner"));
    await user.keyboard("{Escape}");
    expect(innerRefused).toHaveBeenCalledExactlyOnceWith("escape");
    expect(outerDismiss).not.toHaveBeenCalled();
    expect(surface("Inner")).toBeTruthy();
    expect(surface("Outer")).toBeTruthy();
  });
});

describe("one transient surface at a time", () => {
  it("dismisses an open transient surface when an unrelated one opens", async () => {
    const user = userEvent.setup();
    const firstDismiss = vi.fn();
    render(
      <>
        <Opener label="First" kind="transient" onDismissSpy={firstDismiss}><button type="button">One</button></Opener>
        <Opener label="Second" kind="transient"><button type="button">Two</button></Opener>
      </>,
    );
    await user.click(button("Open First"));
    // Reach the second trigger by keyboard, so no outside press is involved.
    act(() => button("Open Second").focus());
    await user.keyboard("{Enter}");

    expect(firstDismiss).toHaveBeenCalledExactlyOnceWith("superseded");
    expect(screen.queryByRole("group", { name: "First" })).toBeNull();
    expect(surface("Second")).toBeTruthy();
    expect(active()).toBe(button("Two"));
  });

  it("keeps the parent open when a transient surface opens from inside it", async () => {
    const user = userEvent.setup();
    const parentDismiss = vi.fn();
    render(
      <Opener label="Parent" kind="transient" onDismissSpy={parentDismiss}>
        <Opener label="Child" kind="transient"><button type="button">Leaf</button></Opener>
      </Opener>,
    );
    await user.click(button("Open Parent"));
    await user.click(button("Open Child"));
    expect(parentDismiss).not.toHaveBeenCalled();
    expect(surface("Parent")).toBeTruthy();
    expect(active()).toBe(button("Leaf"));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Child" })).toBeNull();
    expect(surface("Parent")).toBeTruthy();
    expect(active()).toBe(button("Open Child"));
  });

  it("closes a nested transient and its parent together on a press outside both", async () => {
    const user = userEvent.setup();
    const parentDismiss = vi.fn();
    const childDismiss = vi.fn();
    render(
      <>
        <Opener label="Parent" kind="transient" onDismissSpy={parentDismiss}>
          <Opener label="Child" kind="transient" onDismissSpy={childDismiss}><button type="button">Leaf</button></Opener>
        </Opener>
        <p>Page copy</p>
      </>,
    );
    await user.click(button("Open Parent"));
    await user.click(button("Open Child"));
    await user.click(screen.getByText("Page copy"));
    expect(childDismiss).toHaveBeenCalledWith("outside");
    expect(parentDismiss).toHaveBeenCalledWith("outside");
    expect(screen.queryByRole("group")).toBeNull();
  });
});
