// The ONLY file in the app allowed to import the SQLite package directly
// (CLAUDE.md "Database portability"). Everything else consumes `SqlDriver`
// from ./types via the factory in ./index.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RunResult, SqlDriver } from "./types";

export function createSqliteDriver(filePath: string): SqlDriver {
  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");

  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params: readonly unknown[] = []): RunResult {
      const info = db.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    },
    all<T = unknown>(sql: string, params: readonly unknown[] = []): T[] {
      return db.prepare(sql).all(...params) as T[];
    },
    get<T = unknown>(sql: string, params: readonly unknown[] = []): T | undefined {
      return db.prepare(sql).get(...params) as T | undefined;
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)();
    },
    close(): void {
      db.close();
    },
  };
}
