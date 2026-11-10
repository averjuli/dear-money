import { describe, expect, it } from "vitest";
import {
  categoryStatus,
  daysUntil,
  dailyMove,
  dailyRemaining,
  dailySummary,
  expenseDailyEffect,
  isInMonth,
  monthSpending,
  monthStart,
  nextPayDate,
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
  const summary = (
    remainingRub: number,
    today: string,
    payDays: (number | null)[],
  ) => dailySummary({ remaining: rub(remainingRub), today, payDays });

  it("66 770 left, 10 Nov, advance 25 and salary 10 → until 25 Nov, ≈ 4 451 a day", () => {
    const s = summary(66770, "2026-11-10", [25, 10]);
    expect(s.remaining).toBe(rub(66770));
    expect(s.nextPayDate).toBe("2026-11-25");
    expect(s.perDay).toBe(rub(4451));
  });

  it("26 Nov: the nearest money is 10 Dec, 14 days → 28 000 is ≈ 2 000 a day", () => {
    const s = summary(28000, "2026-11-26", [25, 10]);
    expect(s.nextPayDate).toBe("2026-12-10");
    expect(s.perDay).toBe(rub(2000));
  });

  it("25 Nov is a pay day: 15 days to 10 Dec → 30 000 is ≈ 2 000 a day", () => {
    const s = summary(30000, "2026-11-25", [25, 10]);
    expect(s.nextPayDate).toBe("2026-12-10");
    expect(s.perDay).toBe(rub(2000));
  });

  it("only the salary day 25 is set: 30 000 over 15 days → ≈ 2 000", () => {
    const s = summary(30000, "2026-11-10", [null, 25]);
    expect(s.nextPayDate).toBe("2026-11-25");
    expect(s.perDay).toBe(rub(2000));
  });

  it("salary day 31 in November → 30 Nov, 20 days → 40 000 is ≈ 2 000 a day", () => {
    const s = summary(40000, "2026-11-10", [null, 31]);
    expect(s.nextPayDate).toBe("2026-11-30");
    expect(s.perDay).toBe(rub(2000));
  });

  it("a negative balance keeps the per-day line: −3 000 over 15 days → ≈ −200", () => {
    const s = summary(-3000, "2026-11-10", [25, 10]);
    expect(s.remaining).toBe(rub(-3000));
    expect(s.perDay).toBe(rub(-200));
  });

  it("no days set → no date and no per-day line, the balance stays", () => {
    const s = summary(66770, "2026-11-10", [null, null]);
    expect(s.remaining).toBe(rub(66770));
    expect(s.nextPayDate).toBeNull();
    expect(s.perDay).toBeNull();
  });
});

describe("dailyRemaining", () => {
  const remaining = (toDaily: number[], moves: number[]) =>
    dailyRemaining({ toDaily: toDaily.map(rub), moves: moves.map(rub) });

  it("12 000 left + a new income with 119 225 for daily life = 131 225", () => {
    expect(remaining([12000, 119225], [])).toBe(rub(131225));
  });

  it("−2 000 carries over: −2 000 + 119 225 = 117 225", () => {
    expect(remaining([-2000, 119225], [])).toBe(rub(117225));
  });

  it("86 250 + 5 000 top-up − 2 000 moved to an envelope = 89 250", () => {
    expect(remaining([86250], [5000, -2000])).toBe(rub(89250));
  });

  it("a top-up with an old date: 86 250 + 5 000 = 91 250", () => {
    expect(remaining([86250], [5000])).toBe(rub(91250));
  });

  it("a top-up before a new income stays: 30 000 + 5 000 + 119 225 = 154 225", () => {
    expect(remaining([30000, 119225], [5000])).toBe(rub(154225));
  });

  it("the old top-up 5 000 edited to 6 000 → 155 225", () => {
    expect(remaining([30000, 119225], [5000, 1000])).toBe(rub(155225));
  });

  it("the old top-up 5 000 deleted → 149 225", () => {
    expect(remaining([30000, 119225], [5000, -5000])).toBe(rub(149225));
  });

  it("a back-dated daily expense 1 000 out of 100 000 → 99 000", () => {
    expect(remaining([100000], [-1000])).toBe(rub(99000));
  });

  it("an old expense 2 000 deleted → 102 000", () => {
    expect(remaining([100000], [2000])).toBe(rub(102000));
  });

  it("an old expense 2 000 edited to 2 500 → 99 500", () => {
    expect(remaining([100000], [-500])).toBe(rub(99500));
  });

  it("6 770 moved from «на жизнь» to an envelope: 86 250 − 6 770 = 79 480", () => {
    expect(remaining([86250], [-6770])).toBe(rub(79480));
  });

  it("70 000 moved when 66 770 is left → −3 230", () => {
    expect(remaining([66770], [-70000])).toBe(rub(-3230));
  });

  it("no income, no rows → 0", () => {
    expect(remaining([], [])).toBe(0);
  });
});

describe("nextPayDate", () => {
  it("10 Nov, advance 25 and salary 10 → 25 Nov", () => {
    expect(nextPayDate("2026-11-10", [25, 10])).toBe("2026-11-25");
  });

  it("26 Nov, advance 25 and salary 10 → 10 Dec", () => {
    expect(nextPayDate("2026-11-26", [25, 10])).toBe("2026-12-10");
  });

  it("25 Nov is a pay day itself → the next one, 10 Dec", () => {
    expect(nextPayDate("2026-11-25", [25, 10])).toBe("2026-12-10");
  });

  it("10 Nov, no advance, salary 25 → 25 Nov", () => {
    expect(nextPayDate("2026-11-10", [null, 25])).toBe("2026-11-25");
  });

  it("10 Nov, no advance, salary 31 → 30 Nov, the last day of the month", () => {
    expect(nextPayDate("2026-11-10", [null, 31])).toBe("2026-11-30");
  });

  it("both empty → no date", () => {
    expect(nextPayDate("2026-11-10", [null, null])).toBeNull();
  });

  it("31 Dec, day 10 → 10 Jan of the next year", () => {
    expect(nextPayDate("2026-12-31", [10, null])).toBe("2027-01-10");
  });

  it("15 Jan, day 30 → 30 Jan", () => {
    expect(nextPayDate("2027-01-15", [30, null])).toBe("2027-01-30");
  });

  it("31 Jan, day 30 → 28 Feb (not a leap year)", () => {
    expect(nextPayDate("2027-01-31", [30, null])).toBe("2027-02-28");
  });

  it("31 Jan, day 30 in a leap year → 29 Feb", () => {
    expect(nextPayDate("2028-01-31", [30, null])).toBe("2028-02-29");
  });

  it("30 Nov, day 31 → 31 Dec: 30 Nov is the last day, already today", () => {
    expect(nextPayDate("2026-11-30", [null, 31])).toBe("2026-12-31");
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
