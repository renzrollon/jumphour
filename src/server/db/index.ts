// Call sites import the driver from here (or from ./types for the shape),
// never from ./sqlite-driver or the underlying package. Swapping engines is
// a one-file change: replace the import below.
import path from "node:path";
import { createSqliteDriver } from "./sqlite-driver";
import type { SqlDriver } from "./types";

export type { RunResult, SqlDriver } from "./types";

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured && configured.length > 0) {
    return configured;
  }
  return path.join(process.cwd(), "data", "jumphour.sqlite3");
}

let cachedDriver: SqlDriver | undefined;

/** Returns the process-wide SQL driver, opening it on first use. */
export function getDriver(): SqlDriver {
  if (!cachedDriver) {
    cachedDriver = createSqliteDriver(resolveDatabasePath());
  }
  return cachedDriver;
}

/** Test/tooling seam: force the next getDriver() to open a fresh connection. */
export function resetDriverForTests(): void {
  cachedDriver?.close();
  cachedDriver = undefined;
}
