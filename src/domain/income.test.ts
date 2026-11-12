import { describe, expect, it } from "vitest";
import { planAllocation } from "./allocation";
import {
  deletedEnvelopesShare,
  incomeBreakdown,
  incomeDeletionEffect,
  replayIncomes,
  type BalanceEvent,
  type ReplayEnvelope,
  type ReplayIncome,
  type ReplayedIncome,
} from "./income";
import { demoEnvelopes, demoWallets, rub } from "./test-fixtures";

const wallets = [{ id: "w", name: "W", order: 1 }];

/** A monthly envelope that is full at `cost` (save for 1 time by default). */
function envelope(
  id: string,
  priority: number,
  cost: number,
  start: number,
  createdAt = 0,
): ReplayEnvelope {
  return {
    id,
    walletId: "w",
    name: id.toUpperCase(),
    priority,
    costPerTime: rub(cost),
    periodN: 1,
    periodUnit: "month",
    contributionOverride: null,
    timesToSave: 1,
    startBalance: rub(start),
    createdAt,
  };
}

function income(
  id: string,
  at: number,
  amount: number,
  extra: Partial<ReplayIncome> = {},
): ReplayIncome {
  return {
    id,
    at,
    amount: rub(amount),
    skippedWalletIds: [],
    toDeleted: 0,
    ...extra,
  };
}

function found(result: ReplayedIncome[], id: string): ReplayedIncome {
  const one = result.find((r) => r.id === id);
  if (!one) throw new Error(`Income not replayed: ${id}`);
  return one;
}

function given(
  result: ReplayedIncome[],
  incomeId: string,
  envelopeId: string,
): number {
  return found(result, incomeId)
    .lines.filter((l) => l.envelopeId === envelopeId)
    .reduce((sum, l) => sum + l.amount, 0);
}

/** Start balance plus all given lines minus the events: the balance now. */
function total(
  result: ReplayedIncome[],
  envelopes: ReplayEnvelope[],
  events: BalanceEvent[],
  envelopeId: string,
): number {
  const start = envelopes.find((e) => e.id === envelopeId)!.startBalance;
  const lines = result.reduce((s, r) => s + given([r], r.id, envelopeId), 0);
  const moved = events
    .filter((e) => e.envelopeId === envelopeId)
    .reduce((s, e) => s + e.amount, 0);
  return start + lines + moved;
}

// A: cost 1 000, saves for 1 time, balance 500. B: cost 800, balance 0.
// Half of a monthly contribution per income: A 500, B 400.
const ab = () => [envelope("a", 1, 1000, 500), envelope("b", 2, 800, 0)];

describe("replayIncomes: an edit makes an envelope not full", () => {
  it("the first of two incomes of 10 000 edited to 300", () => {
    const envelopes = ab();
    const result = replayIncomes({
      wallets,
      envelopes,
      events: [],
      incomes: [income("i1", 10, 300), income("i2", 20, 10000)],
    });
    expect(given(result, "i1", "a")).toBe(rub(300));
    expect(given(result, "i1", "b")).toBe(0);
    expect(found(result, "i1").toEnvelopes).toBe(rub(300));
    expect(found(result, "i1").toDaily).toBe(0);
    expect(given(result, "i2", "a")).toBe(rub(500));
    expect(given(result, "i2", "b")).toBe(rub(400));
    expect(
      found(result, "i2").lines.every((l) => l.kind === "contribution"),
    ).toBe(true);
    expect(total(result, envelopes, [], "a")).toBe(rub(1300));
    expect(total(result, envelopes, [], "b")).toBe(rub(400));
  });

  it("the daily share is 9 100 smaller than before the edit", () => {
    const before = replayIncomes({
      wallets,
      envelopes: ab(),
      events: [],
      incomes: [income("i1", 10, 10000), income("i2", 20, 10000)],
    });
    const after = replayIncomes({
      wallets,
      envelopes: ab(),
      events: [],
      incomes: [income("i1", 10, 300), income("i2", 20, 10000)],
    });
    // Before: the second income gave the full A's contribution to B (surplus).
    expect(given(before, "i2", "b")).toBe(rub(900));
    expect(total(before, ab(), [], "a")).toBe(rub(1000));
    expect(total(before, ab(), [], "b")).toBe(rub(1300));
    const daily = (r: ReplayedIncome[]) =>
      r.reduce((sum, one) => sum + one.toDaily, 0);
    expect(daily(before) - daily(after)).toBe(rub(9100));
  });
});

describe("replayIncomes: a deletion makes an envelope not full", () => {
  it("the first income is gone: the second gives A 500, B 400", () => {
    const envelopes = ab();
    const result = replayIncomes({
      wallets,
      envelopes,
      events: [],
      incomes: [income("i2", 20, 10000)],
    });
    expect(given(result, "i2", "a")).toBe(rub(500));
    expect(given(result, "i2", "b")).toBe(rub(400));
    expect(total(result, envelopes, [], "a")).toBe(rub(1000));
    expect(total(result, envelopes, [], "b")).toBe(rub(400));
  });
});

describe("replayIncomes: a spending between incomes", () => {
  it("600 spent from A after the first income, the first is deleted", () => {
    const envelopes = ab();
    const events: BalanceEvent[] = [
      { envelopeId: "a", amount: -rub(600), at: 15 },
    ];
    const result = replayIncomes({
      wallets,
      envelopes,
      events,
      incomes: [income("i2", 20, 10000)],
    });
    // A at the second income: 500 − 600 = −100, not full.
    expect(given(result, "i2", "a")).toBe(rub(500));
    expect(given(result, "i2", "b")).toBe(rub(400));
    expect(total(result, envelopes, events, "a")).toBe(rub(400));
    expect(total(result, envelopes, events, "b")).toBe(rub(400));
  });

  it("a spending made after an income does not count for it", () => {
    const envelopes = ab();
    const events: BalanceEvent[] = [
      { envelopeId: "a", amount: rub(600), at: 25 },
    ];
    // A is 500 at the income, +600 comes later: A is not full at 20, gives 500.
    const result = replayIncomes({
      wallets,
      envelopes,
      events,
      incomes: [income("i2", 20, 10000)],
    });
    expect(given(result, "i2", "a")).toBe(rub(500));
    expect(given(result, "i2", "b")).toBe(rub(400));
  });
});

describe("replayIncomes: an envelope created after an income", () => {
  it("C created after the first income gets nothing from it", () => {
    const envelopes = [...ab(), envelope("c", 3, 2000, 0, 12)];
    const result = replayIncomes({
      wallets,
      envelopes,
      events: [],
      incomes: [income("i1", 10, 12000), income("i2", 20, 10000)],
    });
    expect(given(result, "i1", "c")).toBe(0);
    expect(given(result, "i2", "c")).toBe(rub(1000));
    expect(total(result, envelopes, [], "c")).toBe(rub(1000));
  });
});

describe("replayIncomes: remembered checkboxes", () => {
  const input = () => ({
    wallets: demoWallets(),
    envelopes: demoEnvelopes().map((e): ReplayEnvelope => ({
      id: e.id,
      walletId: e.walletId,
      name: e.name,
      priority: e.priority,
      costPerTime: e.costPerTime,
      periodN: e.periodN,
      periodUnit: e.periodUnit,
      contributionOverride: e.contributionOverride,
      timesToSave: e.timesToSave,
      startBalance: e.balance,
      createdAt: 0,
    })),
    events: [] as BalanceEvent[],
  });

  const perWallet = (result: ReplayedIncome[], incomeId: string) => {
    const { wallets: ws, envelopes } = input();
    const walletOf = new Map(envelopes.map((e) => [e.id, e.walletId]));
    return Object.fromEntries(
      ws.map((w) => [
        w.name,
        found(result, incomeId)
          .lines.filter((l) => walletOf.get(l.envelopeId) === w.id)
          .reduce((s, l) => s + l.amount, 0),
      ]),
    );
  };

  it("salary edited to 160 000, the second income keeps Clothes unchecked", () => {
    const clothes = demoWallets().find((w) => w.name === "Clothes")!;
    const result = replayIncomes({
      ...input(),
      incomes: [
        income("salary", 10, 160000),
        income("other", 20, 20000, { skippedWalletIds: [clothes.id] }),
      ],
    });
    expect(found(result, "salary").toEnvelopes).toBe(rub(30775));
    expect(found(result, "salary").toDaily).toBe(rub(129225));
    expect(perWallet(result, "other")).toEqual({
      Clothes: 0,
      "Self-care": rub(5925),
      Miscellaneous: rub(6550),
      "Long term": rub(5700),
      "Goals WB": rub(1825),
    });
  });

  it("an income without remembered checkboxes counts all wallets as checked", () => {
    const result = replayIncomes({
      ...input(),
      incomes: [income("other", 20, 20000)],
    });
    // Wallets in their order: Clothes comes first and gets its 4 800.
    expect(perWallet(result, "other").Clothes).toBe(rub(4800));
    expect(found(result, "other").toDaily).toBe(0);
  });
});

describe("replayIncomes: money that went to deleted envelopes", () => {
  it("salary 160 000 with 4 500 for the deleted «Одежда»", () => {
    const { wallets: ws, envelopes } = {
      wallets: demoWallets(),
      envelopes: demoEnvelopes()
        .filter((e) => e.name !== "Одежда")
        .map((e): ReplayEnvelope => ({
          ...e,
          startBalance: e.balance,
          createdAt: 0,
        })),
    };
    const result = replayIncomes({
      wallets: ws,
      envelopes,
      events: [],
      incomes: [income("salary", 10, 160000, { toDeleted: rub(4500) })],
    });
    expect(found(result, "salary").toEnvelopes).toBe(rub(30775));
    expect(found(result, "salary").toDaily).toBe(rub(129225));
    const lines = found(result, "salary").lines.reduce(
      (s, l) => s + l.amount,
      0,
    );
    expect(lines).toBe(rub(26275));
  });

  it("the advance keeps its 4 500 and its daily share", () => {
    const envelopes = demoEnvelopes()
      .filter((e) => e.name !== "Одежда")
      .map((e): ReplayEnvelope => ({
        ...e,
        startBalance: e.balance,
        createdAt: 0,
      }));
    const result = replayIncomes({
      wallets: demoWallets(),
      envelopes,
      events: [],
      incomes: [
        income("salary", 10, 160000, { toDeleted: rub(4500) }),
        income("advance", 20, 80000, { toDeleted: rub(4500) }),
      ],
    });
    expect(found(result, "advance").toEnvelopes).toBe(rub(30775));
    expect(found(result, "advance").toDaily).toBe(rub(49225));
  });
});

describe("deletedEnvelopesShare", () => {
  it("30 775 to envelopes, 26 275 still in live lines → 4 500", () => {
    expect(deletedEnvelopesShare(rub(30775), rub(26275))).toBe(rub(4500));
  });

  it("nothing deleted → 0", () => {
    expect(deletedEnvelopesShare(rub(30775), rub(30775))).toBe(0);
  });

  it("lines add up to more than the income says → 0, never negative", () => {
    expect(deletedEnvelopesShare(rub(1000), rub(1500))).toBe(0);
  });
});

describe("incomeBreakdown and incomeDeletionEffect", () => {
  const envelopes = () => demoEnvelopes();
  const wallets = () => demoWallets();
  const names = (list: { name: string }[]) => list.map((x) => x.name);

  const salary = () =>
    planAllocation(wallets(), envelopes(), rub(150000)).lines;

  it("salary 150 000: wallets in their order, without empty ones", () => {
    const view = incomeBreakdown(salary(), wallets(), envelopes(), rub(30775));
    expect(names(view.wallets)).toEqual([
      "Clothes",
      "Self-care",
      "Miscellaneous",
      "Long term",
      "Goals WB",
    ]);
    expect(view.toDeleted).toBe(0);
  });

  it("Self-care 5 925: «Косметология» 4 475 = contribution 750 + surplus 3 725", () => {
    const view = incomeBreakdown(salary(), wallets(), envelopes(), rub(30775));
    const selfCare = view.wallets.find((w) => w.name === "Self-care")!;
    expect(selfCare.amount).toBe(rub(5925));
    const cosmetology = selfCare.envelopes.find(
      (e) => e.name === "Косметология",
    )!;
    expect(cosmetology).toMatchObject({
      amount: rub(4475),
      contribution: rub(750),
      surplus: rub(3725),
    });
    // Full envelopes gave their contributions away and got nothing.
    for (const name of ["Здоровье", "Маникюр", "Стрижка", "Косметика"]) {
      expect(names(selfCare.envelopes)).not.toContain(name);
    }
  });

  it("envelopes of a wallet go by priority", () => {
    const view = incomeBreakdown(salary(), wallets(), envelopes(), rub(30775));
    const selfCare = view.wallets.find((w) => w.name === "Self-care")!;
    const priorities = selfCare.envelopes.map(
      (e) => envelopes().find((x) => x.id === e.envelopeId)!.priority,
    );
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("income 20 000 with Clothes unchecked: no Clothes wallet", () => {
    const clothes = wallets().find((w) => w.name === "Clothes")!;
    const plan = planAllocation(wallets(), envelopes(), rub(20000), [
      clothes.id,
    ]);
    const view = incomeBreakdown(
      plan.lines,
      wallets(),
      envelopes(),
      plan.toEnvelopes,
    );
    expect(names(view.wallets)).not.toContain("Clothes");
  });

  it("«Одежда» deleted after the allocation: Clothes 300, 4 500 in deleted envelopes", () => {
    const left = envelopes().filter((e) => e.name !== "Одежда");
    const gone = envelopes().find((e) => e.name === "Одежда")!;
    // Deleting an envelope removes its lines.
    const lines = salary().filter((l) => l.envelopeId !== gone.id);
    const view = incomeBreakdown(lines, wallets(), left, rub(30775));
    const clothes = view.wallets.find((w) => w.name === "Clothes")!;
    expect(clothes.amount).toBe(rub(300));
    expect(clothes.envelopes.map((e) => [e.name, e.amount])).toEqual([
      ["Украшения", rub(300)],
    ]);
    expect(view.toDeleted).toBe(rub(4500));
  });

  it("deleting salary 150 000: 30 775 leave envelopes, 119 225 leave daily", () => {
    expect(incomeDeletionEffect({ toDaily: rub(119225) }, salary())).toEqual({
      fromEnvelopes: rub(30775),
      fromDaily: rub(119225),
    });
  });
});
