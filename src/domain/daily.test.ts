import { describe, expect, it } from "vitest";
import {
  categoryStatus,
  daysUntil,
  dailySummary,
  isInMonth,
  monthSpending,
  monthStart,
  remainingAfterExpense,
} from "./daily";
import { rub } from "./test-fixtures";

describe("remainingAfterExpense", () => {
  it("66 770 left, daily expense 1 250 → 65 520", () => {
    expect(remainingAfterExpense(rub(66770), rub(1250))).toBe(rub(65520));
  });

  it("can go below zero", () => {
    expect(remainingAfterExpense(rub(500), rub(800))).toBe(rub(-300));
  });
});

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

describe("categoryStatus with envelope expenses", () => {
  it("Транспорт: 2 300 daily + 2 900 from «Тройка на год», limit 4 000 → over by 1 200", () => {
    expect(categoryStatus(rub(4000), rub(2300) + rub(2900))).toEqual({
      kind: "over",
      over: rub(1200),
      share: 1,
    });
  });

  it("Кафе и кофе without the 1 200 from October → 4 860 left", () => {
    const november = [rub(3140)];
    const spent = november.reduce((sum, amount) => sum + amount, 0);
    expect(categoryStatus(rub(8000), spent)).toEqual({
      kind: "ok",
      left: rub(4860),
      share: 0.3925,
    });
  });
});

describe("monthStart", () => {
  it("5 November → 1 November", () => {
    expect(monthStart("2026-11-05")).toBe("2026-11-01");
  });

  it("1 December starts a new month", () => {
    expect(monthStart("2026-12-01")).toBe("2026-12-01");
  });
});

describe("isInMonth", () => {
  it("31 October is not in November", () => {
    expect(isInMonth("2026-10-31", "2026-11-05")).toBe(false);
  });

  it("1 November is in November", () => {
    expect(isInMonth("2026-11-01", "2026-11-05")).toBe(true);
  });

  it("a November date is not in December", () => {
    expect(isInMonth("2026-11-30", "2026-12-01")).toBe(false);
  });

  it("same month of another year is not in the month", () => {
    expect(isInMonth("2025-11-05", "2026-11-05")).toBe(false);
  });
});

describe("monthSpending", () => {
  it("daily 19 480 + 3 900 from «Маникюр» in «Красота» = 23 380", () => {
    expect(
      monthSpending(
        [
          { amount: rub(19480), date: "2026-11-03", categoryId: "food" },
          { amount: rub(3900), date: "2026-11-04", categoryId: "beauty" },
        ],
        "2026-11-05",
      ),
    ).toBe(rub(23380));
  });

  it("an envelope expense without a category is not included", () => {
    expect(
      monthSpending(
        [
          { amount: rub(1500), date: "2026-11-03", categoryId: "food" },
          { amount: rub(3900), date: "2026-11-04", categoryId: null },
        ],
        "2026-11-05",
      ),
    ).toBe(rub(1500));
  });

  it("previous month expenses are not included", () => {
    expect(
      monthSpending(
        [
          { amount: rub(1200), date: "2026-10-31", categoryId: "cafe" },
          { amount: rub(3140), date: "2026-11-01", categoryId: "cafe" },
        ],
        "2026-11-05",
      ),
    ).toBe(rub(3140));
  });

  it("1 December with no expenses yet → 0", () => {
    expect(
      monthSpending(
        [{ amount: rub(19480), date: "2026-11-30", categoryId: "food" }],
        "2026-12-01",
      ),
    ).toBe(0);
  });
});
