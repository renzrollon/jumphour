import { describe, expect, it } from "vitest";
import { STACK } from "./stack";

describe("stack pin", () => {
  it("names the chosen libraries", () => {
    expect(STACK.webFramework).toBe("next");
    expect(STACK.sqlStore).toBe("better-sqlite3");
  });
});
