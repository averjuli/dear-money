import { describe, expect, it } from "vitest";
import {
  ceiling,
  envelopeBalance,
  envelopeStatus,
  monthlyContribution,
  timesCovered,
} from "./envelope";
import { demoEnvelopes, rub } from "./test-fixtures";

const base = { contributionOverride: null, timesToSave: 3 };

describe("monthlyContribution", () => {
  it("every few months: 3 000 every 2 months → 1 500", () => {
    expect(
      monthlyContribution({
        ...base,
        costPerTime: rub(3000),
        periodN: 2,
        periodUnit: "month",
      }),
    ).toBe(rub(1500));
  });

  it("every few weeks: 1 000 every 2 weeks → 2 166,67", () => {
    expect(
      monthlyContribution({
        ...base,
        costPerTime: rub(1000),
        periodN: 2,
        periodUnit: "week",
      }),
    ).toBe(rub(2166.67));
  });

  it("once a year: 12 000 → 1 000", () => {
    expect(
      monthlyContribution({
        ...base,
        costPerTime: rub(12000),
        periodN: 1,
        periodUnit: "year",
      }),
    ).toBe(rub(1000));
  });

  it("manual contribution wins: 4 200 monthly, manual 2 600 → 2 600", () => {
    expect(
      monthlyContribution({
        ...base,
        costPerTime: rub(4200),
        periodN: 1,
        periodUnit: "month",
        contributionOverride: rub(2600),
      }),
    ).toBe(rub(2600));
  });
});

describe("envelopeBalance", () => {
  it("start + allocated − spent", () => {
    expect(
      envelopeBalance({
        startBalance: rub(1000),
        allocated: rub(500),
        spent: rub(200),
      }),
    ).toBe(rub(1300));
  });

  it("an expense can take the envelope below zero: 1 100 − 1 450 = −350", () => {
    expect(
      envelopeBalance({
        startBalance: rub(1100),
        allocated: 0,
        spent: rub(1450),
      }),
    ).toBe(rub(-350));
  });
});

describe("ceiling and status", () => {
  it("full: cost 4 200, save 3 times, balance 12 600", () => {
    const env = { costPerTime: rub(4200), timesToSave: 3 };
    expect(ceiling(env)).toBe(rub(12600));
    expect(envelopeStatus(env, rub(12600))).toBe("full");
    expect(timesCovered(env, rub(12600))).toBe(3);
  });

  it("saving: cost 3 200, save 3 times, balance 7 300 → enough for 2", () => {
    const env = { costPerTime: rub(3200), timesToSave: 3 };
    expect(envelopeStatus(env, rub(7300))).toBe("saving");
    expect(timesCovered(env, rub(7300))).toBe(2);
  });

  it("minus: cost 1 100, balance −350", () => {
    const env = { costPerTime: rub(1100), timesToSave: 3 };
    expect(envelopeStatus(env, rub(-350))).toBe("minus");
    expect(timesCovered(env, rub(-350))).toBe(0);
  });

  it("zero cost never divides by zero", () => {
    const env = { costPerTime: 0, timesToSave: 3 };
    expect(timesCovered(env, rub(100))).toBe(0);
  });
});

describe("demo data totals", () => {
  it("wallet Clothes shows 6 400 + 27 300 = 33 700", () => {
    const clothes = demoEnvelopes().filter((e) => e.walletId === "w1");
    expect(clothes.reduce((s, e) => s + e.balance, 0)).toBe(rub(33700));
  });

  it("«Всего в конвертах» across all wallets is 233 950", () => {
    expect(demoEnvelopes().reduce((s, e) => s + e.balance, 0)).toBe(
      rub(233950),
    );
  });
});
