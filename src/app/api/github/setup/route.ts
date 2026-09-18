import { NextResponse } from "next/server";
import { getDriver } from "../../../../server/db";
import { getEnv } from "../../../../server/env";
import { fetchInstallationAccount } from "../../../../server/github/app-client";
import { recordInstallationFromSetup, type RecordInstallationOutcome } from "../../../../server/github/setup-installation";

// GitHub App Setup URL target (design.md Decision 1). GitHub redirects the
// installing admin here with `installation_id` and `setup_action` after
// install/update — no Marketplace listing and no webhook required for this
// to work. Persisting the installation (task 3.2) delegates to
// recordInstallationFromSetup, which resolves the account via the App-JWT
// `GET /app/installations/{id}` read (task 3.1) — never a GitHub write.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");

  let outcome: RecordInstallationOutcome;
  try {
    const env = getEnv();
    outcome = await recordInstallationFromSetup({
      installationIdParam: installationId,
      setupAction,
      driver: getDriver(),
      fetchInstallationAccount: (githubInstallationId) => {
        if (!env.githubAppId || !env.githubAppPrivateKey) {
          throw new Error("GitHub App credentials are not configured");
        }
        return fetchInstallationAccount({
          appId: env.githubAppId,
          privateKey: env.githubAppPrivateKey,
          installationId: githubInstallationId,
        });
      },
    });
  } catch (err) {
    outcome = { recorded: false, reason: err instanceof Error ? err.message : "unknown error" };
  }

  return NextResponse.json({
    ok: true,
    route: "github-app-setup-url",
    installationId,
    setupAction,
    recorded: outcome.recorded,
    ...(outcome.recorded ? {} : { reason: outcome.reason }),
  });
}
