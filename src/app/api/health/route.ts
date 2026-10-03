import path from "node:path";
import { NextResponse } from "next/server";
import { getDriver } from "../../../server/db";
import { runMigrations } from "../../../server/db/migrate";
import { getEnv } from "../../../server/env";

// Never statically optimized: this reads live env/DB state on every request.
export const dynamic = "force-dynamic";

// Server-only proof that this scaffold can hold secrets from the
// environment and reach a SQL store: runs the migrator, confirms the
// bookkeeping table is reachable, and reports which GitHub App secrets are
// configured by name only — never their values.
export async function GET() {
  const driver = getDriver();
  const migrationsDir = path.join(process.cwd(), "migrations");
  const migrations = runMigrations(driver, migrationsDir);

  const env = getEnv();

  return NextResponse.json({
    ok: true,
    database: {
      reachable: true,
      migrationsApplied: migrations.applied,
      migrationsTotal: migrations.allApplied.length,
    },
    secrets: {
      githubAppIdConfigured: Boolean(env.githubAppId),
      githubAppPrivateKeyConfigured: Boolean(env.githubAppPrivateKey),
      githubAppClientIdConfigured: Boolean(env.githubAppClientId),
      githubAppClientSecretConfigured: Boolean(env.githubAppClientSecret),
    },
  });
}
