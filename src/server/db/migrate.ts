// Small migration runner: applies plain .sql files from a directory, in
// filename order, tracked in a bookkeeping table. No engine-specific SQL —
// this file (and every migration file it reads) must read the same against
// SQLite today and Postgres later (CLAUDE.md "Database portability").
import { readdirSync, readFileSync } from "node:fs";
import type { SqlDriver } from "./types";

const BOOKKEEPING_TABLE = "schema_migrations";

const CREATE_BOOKKEEPING_TABLE = `
CREATE TABLE IF NOT EXISTS ${BOOKKEEPING_TABLE} (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
)
`;

export interface MigrationResult {
  /** Migration filenames applied during this run, in the order applied. */
  applied: string[];
  /** Every migration filename recorded as applied, including prior runs. */
  allApplied: string[];
}

function listMigrationFiles(migrationsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(migrationsDir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

/**
 * Applies every not-yet-applied `.sql` file in `migrationsDir`, in
 * lexicographic filename order, each inside its own transaction alongside
 * its bookkeeping row. Safe to call repeatedly: already-applied files are
 * skipped.
 */
export function runMigrations(driver: SqlDriver, migrationsDir: string): MigrationResult {
  driver.exec(CREATE_BOOKKEEPING_TABLE);

  const alreadyApplied = new Set(
    driver
      .all<{ name: string }>(`SELECT name FROM ${BOOKKEEPING_TABLE} ORDER BY name`)
      .map((row) => row.name),
  );

  const applied: string[] = [];
  for (const fileName of listMigrationFiles(migrationsDir)) {
    if (alreadyApplied.has(fileName)) {
      continue;
    }
    const sql = readFileSync(`${migrationsDir}/${fileName}`, "utf8");
    driver.transaction(() => {
      driver.exec(sql);
      driver.run(`INSERT INTO ${BOOKKEEPING_TABLE} (name, applied_at) VALUES (?, ?)`, [
        fileName,
        new Date().toISOString(),
      ]);
    });
    applied.push(fileName);
    alreadyApplied.add(fileName);
  }

  return {
    applied,
    allApplied: Array.from(alreadyApplied).sort(),
  };
}
