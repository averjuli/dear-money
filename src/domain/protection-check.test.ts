import { describe, expect, it } from "vitest";

// Deliberately red: checks that main protection blocks a PR with a failing test. Never merge.
describe("main protection check", () => {
  it("fails on purpose", () => {
    expect(1 + 1).toBe(3);
  });
});
