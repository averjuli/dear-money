import { describe, expect, it } from "vitest";
import { expenseHint, recentTargets } from "./expense";
import { rub } from "./test-fixtures";

describe("expenseHint", () => {
  it("Маникюр: 12 600 − 3 900 → 8 700, enough for 2 more times", () => {
    expect(
      expenseHint({ balance: rub(12600), costPerTime: rub(4200) }, rub(3900)),
    ).toEqual({ newBalance: rub(8700), times: 2, negative: false });
  });

  it("Брови: 1 100 − 1 450 → −350, negative", () => {
    expect(
      expenseHint({ balance: rub(1100), costPerTime: rub(1100) }, rub(1450)),
    ).toEqual({ newBalance: rub(-350), times: 0, negative: true });
  });
});

describe("recentTargets", () => {
  const fallback = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];

  it("first expense: shows the first envelopes in wallet order", () => {
    expect(recentTargets([], fallback)).toEqual([
      "e1",
      "e2",
      "e3",
      "e4",
      "e5",
      "e6",
    ]);
  });

  it("up to six last used, newest first, without repeats", () => {
    expect(
      recentTargets(["e9", "e3", "e9", "e1", "e8", "e7", "e6", "e5"], fallback),
    ).toEqual(["e9", "e3", "e1", "e8", "e7", "e6"]);
  });

  it("fills up with fallback when fewer than six were used", () => {
    expect(recentTargets(["e5"], fallback)).toEqual([
      "e5",
      "e1",
      "e2",
      "e3",
      "e4",
      "e6",
    ]);
  });
});
