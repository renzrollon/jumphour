// Task 10.3 (design.md Decision 9, Decision 8): fixture identity data for the
// /dev/ui index's shell. `Platform delivery` and `Priya Nair` are the Claude
// Design prototype's sample names (design.md Decision 8's honesty rule) —
// fixture-only, and, per task 11.3, must appear nowhere outside this
// directory and test files. `PrimitivesGallery` renders the persistent
// "Preview — fixture data" label alongside them so nobody mistakes the shell
// for a real installation or account.
import type { WorkspaceView } from "../../../components/shell/workspace";
import type { AccountView } from "../../../components/shell/account";

export const PREVIEW_WORKSPACE_LOGIN = "Platform delivery";
export const PREVIEW_ACCOUNT_LOGIN = "Priya Nair";

const PREVIEW_INSTALLATION_ID = 1;

export const PREVIEW_WORKSPACE: WorkspaceView = {
  current: { installationId: PREVIEW_INSTALLATION_ID, accountLogin: PREVIEW_WORKSPACE_LOGIN },
  installations: [{ installationId: PREVIEW_INSTALLATION_ID, accountLogin: PREVIEW_WORKSPACE_LOGIN }],
};

export const PREVIEW_ACCOUNT: AccountView = { login: PREVIEW_ACCOUNT_LOGIN };
