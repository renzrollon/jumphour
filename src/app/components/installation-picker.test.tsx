// Task 8.1: "optional installation picker" — renders nothing for a
// signed-in user with zero or one installation, and renders a chooser once
// design.md Decision 3's multi-installation case applies.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallationPicker } from "./installation-picker";

describe("InstallationPicker", () => {
  it("renders nothing when there is at most one installation", () => {
    expect(renderToStaticMarkup(<InstallationPicker installations={[]} currentInstallationId={null} />)).toBe("");

    expect(
      renderToStaticMarkup(
        <InstallationPicker
          installations={[{ installationId: 1, accountLogin: "acme" }]}
          currentInstallationId={1}
        />,
      ),
    ).toBe("");
  });

  it("renders every installation option once there are two or more", () => {
    const html = renderToStaticMarkup(
      <InstallationPicker
        installations={[
          { installationId: 1, accountLogin: "acme" },
          { installationId: 2, accountLogin: "beta-org" },
        ]}
        currentInstallationId={1}
      />,
    );

    expect(html).toContain("acme");
    expect(html).toContain("beta-org");
  });
});
