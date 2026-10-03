// The board's one production provider (design.md Decision 2). It is the only
// place lane membership, listener state, and action availability are derived;
// components render the returned `BoardViewModel` and never recompute any of
// it. Reads go through the `SqlDriver` interface only, and nothing here calls
// GitHub or writes a row.
//
// `now` is injected so `generatedAt` — the instant every relative time on the
// board is measured against — is deterministic in tests.
import type { SqlDriver } from "../db/types";
import type { SessionRow } from "../db/sessions";
import { getInstallation } from "../db/installations";
import { listInstallationRepositories } from "../db/installation-repositories";
import type { Availability, BoardViewModel, LaneViewModel, ManualRead } from "../../lib/board/board-view-model";
import { LANE_IDS } from "../../lib/board/lanes";

/** Why Load ideas and Compose idea are unavailable until an intake change enables them (shared brief). */
export const IDEA_INTAKE_UNAVAILABLE_REASON = "Idea intake is not enabled for this installation yet.";

/** The provider reads only the session's current installation. */
export type BoardSession = Pick<SessionRow, "installationId">;

/** Why Fetch PRs/MRs is unavailable until a PR/MR fetch change enables it (shared brief). */
export const PR_MR_FETCH_UNAVAILABLE_REASON = "PR and MR fetching is not enabled for this installation yet.";

const INTAKE_UNAVAILABLE: Availability = { status: "unavailable", reason: IDEA_INTAKE_UNAVAILABLE_REASON };
const PR_MR_FETCH_UNAVAILABLE: Availability = { status: "unavailable", reason: PR_MR_FETCH_UNAVAILABLE_REASON };

type LaneTuple = BoardViewModel["lanes"];

/** Four lanes in `LANE_IDS` order, with no cards and no configured listener. */
function emptyLanes(): LaneTuple {
  const lane = (id: (typeof LANE_IDS)[number]): LaneViewModel => ({
    id,
    listener: { status: "not-configured" },
    manualRead: null,
    cards: [],
  });
  const [idea, change, progress, prMr] = LANE_IDS;
  return [lane(idea), lane(change), lane(progress), lane(prMr)];
}

/**
 * Four empty lanes with a manual read on the two edge lanes only: `load-ideas`
 * on `idea` and `fetch-pull-requests` on `pr-mr`, both unavailable today with
 * no provider options. The two middle lanes never carry one (Decision 2).
 */
function installationLanes(): LaneTuple {
  const [idea, change, progress, prMr] = emptyLanes();
  const loadIdeas: ManualRead = { kind: "load-ideas", availability: INTAKE_UNAVAILABLE, options: [] };
  const fetchPullRequests: ManualRead = {
    kind: "fetch-pull-requests",
    availability: PR_MR_FETCH_UNAVAILABLE,
    options: [],
  };
  return [{ ...idea, manualRead: loadIdeas }, change, progress, { ...prMr, manualRead: fetchPullRequests }];
}

export function buildBoardView(driver: SqlDriver, session: BoardSession, now: Date): BoardViewModel {
  const generatedAt = now.toISOString();

  if (session.installationId === null) {
    // No installation bound to the session: nothing is read, and nothing of
    // any installation can appear. The page explains that an installation is
    // required instead of rendering these lanes.
    return {
      generatedAt,
      installation: null,
      repositories: [],
      lanes: emptyLanes(),
      compose: INTAKE_UNAVAILABLE,
    };
  }

  const installation = getInstallation(driver, session.installationId);
  if (installation === undefined) {
    // The session names an installation with no stored row: there is no
    // account to show, so render the same shape as "no installation" rather
    // than invent a label or reach for any other installation's rows.
    return {
      generatedAt,
      installation: null,
      repositories: [],
      lanes: emptyLanes(),
      compose: INTAKE_UNAVAILABLE,
    };
  }

  // Both reads are scoped by `installation_id` in SQL (Decision 2; spec
  // "Scope the board to the current installation").
  const repositories = listInstallationRepositories(driver, installation.installationId).map((row) => ({
    githubRepoId: row.githubRepoId,
    fullName: row.fullName,
  }));

  return {
    generatedAt,
    installation: { installationId: installation.installationId, accountLogin: installation.accountLogin },
    repositories,
    lanes: installationLanes(),
    compose: INTAKE_UNAVAILABLE,
  };
}
