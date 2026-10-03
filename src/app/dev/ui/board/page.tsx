// workflow-board-ui task 7.3 (design.md Decision 10; specs/ui-preview-gallery
// /spec.md "Serve preview pages only when explicitly enabled", "Reproduce the
// designed board scenarios by name"): /dev/ui/board. `previewGuard()` runs as
// the very first statement, so with JUMPHOUR_UI_PREVIEW anything but exactly
// "1" this page answers not-found before it reads a parameter, a cookie, or a
// fixture. Enabled, it renders the real `BoardScreen` over the fixture view
// for `?scenario=` (`parseScenario`: trim + lowercase, unknown → `populated`)
// inside the same shell the /dev/ui index uses, under the persistent
// "Preview — fixture data" label naming the displayed scenario. This route
// never reads the database.
import { cookies } from "next/headers";
import { previewGuard } from "../preview-guard";
import { CATS_COOKIE, THEME_COOKIE, parseAppearance } from "../../../../lib/appearance/appearance";
import { boardScenario, parseScenario } from "../fixtures/board";
import { PREVIEW_ACCOUNT, PREVIEW_WORKSPACE } from "../fixtures/shell";
import { BoardPreview } from "./board-preview";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BoardPreviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  previewGuard();

  const params = await searchParams;
  const scenario = boardScenario(parseScenario(params.scenario));

  const cookieStore = await cookies();
  const appearance = parseAppearance({
    theme: cookieStore.get(THEME_COOKIE)?.value,
    cats: cookieStore.get(CATS_COOKIE)?.value,
  });

  return (
    <BoardPreview
      key={scenario.name}
      scenario={scenario}
      shell={{ workspace: PREVIEW_WORKSPACE, account: PREVIEW_ACCOUNT, appearance }}
    />
  );
}
