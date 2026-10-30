import { describe, expect, it } from "vitest";
import { categoryStatus, daysUntil, dailySummary } from "./daily";
import { rub } from "./test-fixtures";

describe("dailySummary", () => {
  it("mid-month: budget 86 250, spent 19 480 → 66 770 left", () => {
    const s = dailySummary({
      budget: rub(86250),
      spent: rub(19480),
      today: "2026-10-21",
      nextIncomeDate: "2026-11-05",
    });
    expect(s.remaining).toBe(rub(66770));
    expect(s.spent).toBe(rub(19480));
    expect(s.budget).toBe(rub(86250));
  });

  it("per day: 66 770 over 15 days including today → ≈ 4 451", () => {
    const s = dailySummary({
      budget: rub(86250),
      spent: rub(19480),
      today: "2026-10-21",
      nextIncomeDate: "2026-11-05",
    });
    expect(s.daysLeft).toBe(15);
    expect(s.perDay).toBe(rub(4451));
  });

  it("no next income date → no per-day line", () => {
    const s = dailySummary({
      budget: rub(1000),
      spent: 0,
      today: "2026-10-21",
      nextIncomeDate: null,
    });
    expect(s.perDay).toBeNull();
  });

  it("next income date already passed → no per-day line", () => {
    const s = dailySummary({
      budget: rub(1000),
      spent: 0,
      today: "2026-11-06",
      nextIncomeDate: "2026-11-05",
    });
    expect(s.perDay).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts days from today up to the date, today included", () => {
    expect(daysUntil("2026-10-21", "2026-11-05")).toBe(15);
    expect(daysUntil("2026-10-21", "2026-10-22")).toBe(1);
    expect(daysUntil("2026-10-21", "2026-10-21")).toBe(0);
  });
});

describe("categoryStatus", () => {
  it("limit exceeded: Транспорт 6 230 of 4 000 → over by 2 230", () => {
    expect(categoryStatus(rub(4000), rub(6230))).toEqual({
      kind: "over",
      over: rub(2230),
      share: 1,
    });
  });

  it("within limit: Кафе и кофе 3 140 of 8 000 → 4 860 left", () => {
    expect(categoryStatus(rub(8000), rub(3140))).toEqual({
      kind: "ok",
      left: rub(4860),
      share: 0.3925,
    });
  });

  it("no limit: Продукты 5 870 → only the amount", () => {
    expect(categoryStatus(null, rub(5870))).toEqual({ kind: "none" });
  });
});
