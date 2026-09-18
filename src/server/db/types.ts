// Portable SQL driver interface. Every query in the app goes through this
// shape so the engine (SQLite today, Postgres later) is a one-file swap —
// see CLAUDE.md "Database portability". No file outside a driver
// implementation (e.g. sqlite-driver.ts) may import an engine package.

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface SqlDriver {
  /** Execute one or more statements with no parameters and no result rows
   * (schema DDL, migration scripts). */
  exec(sql: string): void;
  /** Execute a single parameterized statement that does not return rows. */
  run(sql: string, params?: readonly unknown[]): RunResult;
  /** Execute a single parameterized statement and return every matching row. */
  all<T = unknown>(sql: string, params?: readonly unknown[]): T[];
  /** Execute a single parameterized statement and return the first row, if any. */
  get<T = unknown>(sql: string, params?: readonly unknown[]): T | undefined;
  /** Run `fn` atomically; rolls back on a thrown error. */
  transaction<T>(fn: () => T): T;
  /** Release the underlying connection/handle. */
  close(): void;
}
