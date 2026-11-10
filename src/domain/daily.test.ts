import { describe, expect, it } from "vitest";
import {
  categoryStatus,
  daysUntil,
  dailyMove,
  dailySummary,
  expenseDailyEffect,
  isInMonth,
  monthSpending,
  monthStart,
  periodBudget,
  periodSpent,
  remainingAfterExpense,
} from "./daily";
import { rub } from "./test-fixtures";

describe("remainingAfterExpense", () => {
  it("66 770 left, new daily expense 1 250 → 65 520", () => {
    expect(
      remainingAfterExpense({
        remaining: rub(66770),
        amount: rub(1250),
        journaled: 0,
      }),
    ).toBe(rub(65520));
  });

  it("65 520 left after 1 250, the expense edited to 1 500 → 65 270", () => {
    expect(
      remainingAfterExpense({
        remaining: rub(65520),
        amount: rub(1500),
        journaled: rub(-1250),
      }),
    ).toBe(rub(65270));
  });

  it("an expense made before the first allocation, edited to 1 500 → counted whole", () => {
    expect(
      remainingAfterExpense({
        remaining: rub(66770),
        amount: rub(1500),
        journaled: 0,
      }),
    ).toBe(rub(65270));
  });

  it("can go below zero", () => {
    expect(
      remainingAfterExpense({
        remaining: rub(500),
        amount: rub(800),
        journaled: 0,
      }),
    ).toBe(rub(-300));
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

describe("expenseDailyEffect", () => {
  it("a daily expense takes its amount from «на жизнь»", () => {
    expect(expenseDailyEffect({ amount: rub(1000), envelopeId: null })).toBe(
      rub(-1000),
    );
  });

  it("an envelope expense does not touch «на жизнь»", () => {
    expect(expenseDailyEffect({ amount: rub(1000), envelopeId: "e1" })).toBe(0);
  });

  it("a deleted expense has no effect", () => {
    expect(expenseDailyEffect(null)).toBe(0);
  });
});

describe("dailyMove for expenses", () => {
  const daily = (amount: number) => ({ amount, envelopeId: null });

  it("new daily expense 1 000, any date → −1 000", () => {
    expect(
      dailyMove({
        effect: expenseDailyEffect(daily(rub(1000))),
        journaled: 0,
      }),
    ).toBe(rub(-1000));
  });

  it("new envelope expense → 0", () => {
    expect(
      dailyMove({
        effect: expenseDailyEffect({ amount: rub(1000), envelopeId: "e1" }),
        journaled: 0,
      }),
    ).toBe(0);
  });

  it("edit 2 000 → 2 500 → −500", () => {
    expect(
      dailyMove({
        effect: expenseDailyEffect(daily(rub(2500))),
        journaled: rub(-2000),
      }),
    ).toBe(rub(-500));
  });

  it("only the date changed → 0", () => {
    expect(
      dailyMove({
        effect: expenseDailyEffect(daily(rub(2000))),
        journaled: rub(-2000),
      }),
    ).toBe(0);
  });

  it("delete 2 000 → +2 000", () => {
    expect(
      dailyMove({ effect: expenseDailyEffect(null), journaled: rub(-2000) }),
    ).toBe(rub(2000));
  });

  it("daily 1 250 turned into an envelope expense → +1 250, and back → −1 250", () => {
    expect(
      dailyMove({
        effect: expenseDailyEffect({ amount: rub(1250), envelopeId: "e1" }),
        journaled: rub(-1250),
      }),
    ).toBe(rub(1250));
    expect(
      dailyMove({
        effect: expenseDailyEffect(daily(rub(1250))),
        journaled: 0,
      }),
    ).toBe(rub(-1250));
  });

  it("an expense made before the first allocation (nothing journaled) is deleted → 0", () => {
    expect(dailyMove({ effect: expenseDailyEffect(null), journaled: 0 })).toBe(
      0,
    );
  });
});

describe("periodBudget", () => {
  const budget = (toDaily: number, moves: number[]) =>
    periodBudget({ toDaily: rub(toDaily), transferMoves: moves.map(rub) });

  it("86 250 + 5 000 top-up − 2 000 moved to an envelope = 89 250", () => {
    expect(budget(86250, [5000, -2000])).toBe(rub(89250));
  });

  it("a top-up with an old date: 86 250 + 5 000 = 91 250", () => {
    expect(budget(86250, [5000])).toBe(rub(91250));
  });

  it("an old top-up of 5 000 edited to 6 000: 119 225 + 1 000 = 120 225", () => {
    expect(budget(119225, [1000])).toBe(rub(120225));
  });

  it("an old top-up of 5 000 deleted: 119 225 − 5 000 = 114 225", () => {
    expect(budget(119225, [-5000])).toBe(rub(114225));
  });

  it("only the date changed (no rows), or a new period: 119 225", () => {
    expect(budget(119225, [])).toBe(rub(119225));
  });
});

describe("periodSpent", () => {
  it("rows of expenses: −19 225 → spent 19 225", () => {
    expect(periodSpent([rub(-19225)])).toBe(rub(19225));
  });

  it("a back-dated expense 1 000 → 20 225, left 99 000", () => {
    const spent = periodSpent([rub(-19225), rub(-1000)]);
    expect(spent).toBe(rub(20225));
    expect(
      dailySummary({
        budget: rub(119225),
        spent,
        today: "2026-11-20",
        nextIncomeDate: null,
      }).remaining,
    ).toBe(rub(99000));
  });

  it("an old expense of 2 000 deleted → 17 225, left 102 000", () => {
    const spent = periodSpent([rub(-19225), rub(2000)]);
    expect(spent).toBe(rub(17225));
    expect(
      dailySummary({
        budget: rub(119225),
        spent,
        today: "2026-11-20",
        nextIncomeDate: null,
      }).remaining,
    ).toBe(rub(102000));
  });

  it("an old expense of 2 000 edited to 2 500 → 19 725, left 99 500", () => {
    const spent = periodSpent([rub(-19225), rub(-500)]);
    expect(spent).toBe(rub(19725));
    expect(
      dailySummary({
        budget: rub(119225),
        spent,
        today: "2026-11-20",
        nextIncomeDate: null,
      }).remaining,
    ).toBe(rub(99500));
  });

  it("no rows → 0", () => {
    expect(periodSpent([])).toBe(0);
  });
});

describe("dailySummary with transfers", () => {
  const left = (budgetRub: number, spentRub: number) =>
    dailySummary({
      budget: rub(budgetRub),
      spent: rub(spentRub),
      today: "2026-11-20",
      nextIncomeDate: null,
    });

  it("top-up 5 000: budget 91 250, spent 19 480 → left 71 770", () => {
    const budget = periodBudget({
      toDaily: rub(86250),
      transferMoves: [rub(5000)],
    });
    expect(budget).toBe(rub(91250));
    expect(left(91250, 19480).remaining).toBe(rub(71770));
  });

  it("6 770 moved from «на жизнь» to an envelope: budget 79 480 → left 60 000", () => {
    const budget = periodBudget({
      toDaily: rub(86250),
      transferMoves: [rub(-6770)],
    });
    expect(budget).toBe(rub(79480));
    expect(left(79480, 19480).remaining).toBe(rub(60000));
  });

  it("70 000 moved when 66 770 is left → −3 230", () => {
    expect(left(86250 - 70000, 19480).remaining).toBe(rub(-3230));
  });
});
