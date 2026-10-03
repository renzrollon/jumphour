import { describe, expect, it } from "vitest";
import { createSqliteDriver } from "./sqlite-driver";

describe("createSqliteDriver", () => {
  it("execs DDL and runs parameterized CRUD through the portable interface", () => {
    const driver = createSqliteDriver(":memory:");
    try {
      driver.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

      const inserted = driver.run("INSERT INTO widgets (name) VALUES (?)", ["sprocket"]);
      expect(inserted.changes).toBe(1);

      const row = driver.get<{ id: number; name: string }>(
        "SELECT id, name FROM widgets WHERE name = ?",
        ["sprocket"],
      );
      expect(row?.name).toBe("sprocket");

      driver.run("INSERT INTO widgets (name) VALUES (?)", ["cog"]);
      const rows = driver.all<{ name: string }>("SELECT name FROM widgets ORDER BY name");
      expect(rows.map((r) => r.name)).toEqual(["cog", "sprocket"]);
    } finally {
      driver.close();
    }
  });

  it("rolls back a transaction when the callback throws", () => {
    const driver = createSqliteDriver(":memory:");
    try {
      driver.exec("CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

      expect(() =>
        driver.transaction(() => {
          driver.run("INSERT INTO widgets (name) VALUES (?)", ["doomed"]);
          throw new Error("boom");
        }),
      ).toThrow("boom");

      const rows = driver.all("SELECT * FROM widgets");
      expect(rows).toHaveLength(0);
    } finally {
      driver.close();
    }
  });
});
