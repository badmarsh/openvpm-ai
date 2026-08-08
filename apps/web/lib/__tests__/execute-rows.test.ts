import { describe, expect, it } from "vitest";
import { rowsFromExecute } from "@/lib/db/execute-rows";

describe("rowsFromExecute", () => {
  it("supports direct Postgres row arrays", () => {
    expect(rowsFromExecute<{ id: string }>([{ id: "one" }])).toEqual([
      { id: "one" },
    ]);
  });

  it("supports adapters that wrap execute rows", () => {
    expect(rowsFromExecute<{ id: string }>({ rows: [{ id: "one" }] })).toEqual([
      { id: "one" },
    ]);
  });

  it("does not invent rows for unknown execute shapes", () => {
    expect(rowsFromExecute(null)).toEqual([]);
    expect(rowsFromExecute({ rowCount: 1 })).toEqual([]);
  });
});
