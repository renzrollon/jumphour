// @vitest-environment jsdom
// Task 1.2: proves the per-file DOM opt-in (design.md Decision 5). vitest.config.ts
// stays at environment "node"; this file alone runs under jsdom, and drives a
// trivial component with Testing Library and user-event in the same run as the
// renderToStaticMarkup suites.
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
});

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Clicked {count}
    </button>
  );
}

describe("DOM test environment opt-in", () => {
  it("runs this file under jsdom", () => {
    expect(typeof document).toBe("object");
    expect(navigator.userAgent).toContain("jsdom");
  });

  it("renders with Testing Library and responds to user-event clicks and keys", async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const button = screen.getByRole("button", { name: "Clicked 0" });
    await user.click(button);
    expect(button.textContent).toBe("Clicked 1");

    // The click focused the button, so Enter activates it from the keyboard.
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    expect(button.textContent).toBe("Clicked 2");
  });
});
