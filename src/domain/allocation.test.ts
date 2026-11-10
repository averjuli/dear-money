import { describe, expect, it } from "vitest";
import {
  planAllocation,
  planWallet,
  type AllocationEnvelope,
} from "./allocation";
import { demoEnvelopes, demoWallets, rub } from "./test-fixtures";

function balanceAfter(
  envelopes: AllocationEnvelope[],
  lines: { envelopeId: string; amount: number }[],
  name: string,
): number {
  const env = envelopes.find((e) => e.name === name)!;
  const added = lines
    .filter((l) => l.envelopeId === env.id)
    .reduce((s, l) => s + l.amount, 0);
  return env.balance + added;
}

function sumFor(
  lines: { envelopeId: string; amount: number }[],
  envelopeId: string,
): number {
  return lines
    .filter((l) => l.envelopeId === envelopeId)
    .reduce((s, l) => s + l.amount, 0);
}

const settings = {
  periodN: 1,
  periodUnit: "month" as const,
  contributionOverride: null,
  timesToSave: 1,
};

function env(
  id: string,
  priority: number,
  costPerTime: number,
  balance: number,
  timesToSave = 1,
): AllocationEnvelope {
  return {
    ...settings,
    id,
    walletId: "w",
    name: id.toUpperCase(),
    priority,
    costPerTime: rub(costPerTime),
    balance: rub(balance),
    timesToSave,
  };
}

describe("preview: salary 150 000 with demo data", () => {
  const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(150000));

  it("30 775 to envelopes, 119 225 to daily spending", () => {
    expect(plan.toEnvelopes).toBe(rub(30775));
    expect(plan.toDaily).toBe(rub(119225));
    expect(plan.shortage).toBe(0);
    expect(plan.needsChoice).toBe(false);
  });

  it("per wallet, largest first", () => {
    expect(plan.wallets.map((w) => [w.name, w.amount])).toEqual([
      ["Goals WB", rub(7800)],
      ["Miscellaneous", rub(6550)],
      ["Self-care", rub(5925)],
      ["Long term", rub(5700)],
      ["Clothes", rub(4800)],
    ]);
  });
});

describe("half of the contribution per income", () => {
  it("manual contribution 2 600 → 1 300 per income", () => {
    const envelopes = [
      { ...env("a", 1, 4200, 0, 3), contributionOverride: rub(2600) },
    ];
    const plan = planAllocation(
      [{ id: "w", name: "W", order: 1 }],
      envelopes,
      rub(10000),
    );
    expect(plan.lines).toEqual([
      expect.objectContaining({ envelopeId: "a", amount: rub(1300) }),
    ]);
  });

  it("manual 2 166,67 a month → 1 083,34 per income", () => {
    const envelopes: AllocationEnvelope[] = [
      {
        ...env("a", 1, 1000, 0, 3),
        contributionOverride: 216_667,
      },
    ];
    const plan = planAllocation(
      [{ id: "w", name: "W", order: 1 }],
      envelopes,
      rub(10000),
    );
    expect(plan.lines[0].amount).toBe(108_334);
  });

  it("1 000 every 2 weeks → 2 200 a month → 1 100 per income", () => {
    const envelopes: AllocationEnvelope[] = [
      {
        ...env("a", 1, 1000, 0, 3),
        periodN: 2,
        periodUnit: "week",
      },
    ];
    const plan = planAllocation(
      [{ id: "w", name: "W", order: 1 }],
      envelopes,
      rub(10000),
    );
    expect(plan.lines[0].amount).toBe(rub(1100));
  });
});

describe("surplus in Self-care", () => {
  const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(150000));
  const selfCare = plan.surpluses.find((s) => s.walletName === "Self-care")!;

  it("full envelopes give 1 500 + 1 300 + 225 + 700 = 3 725 to «Косметология»", () => {
    expect(selfCare.fullEnvelopeNames).toEqual([
      "Здоровье",
      "Маникюр",
      "Стрижка",
      "Косметика",
    ]);
    expect(selfCare.amount).toBe(rub(3725));
    expect(selfCare.receivers).toEqual([
      { envelopeId: "w2e2", name: "Косметология", amount: rub(3725) },
    ]);
    expect(selfCare.allFull).toBe(false);
  });

  it("«Косметология» gets 750 + 3 725 = 4 475: −27 400 → −22 925", () => {
    const kosmLines = plan.lines.filter((l) => l.envelopeId === "w2e2");
    expect(kosmLines.reduce((s, l) => s + l.amount, 0)).toBe(rub(4475));
    expect(kosmLines.find((l) => l.kind === "contribution")?.amount).toBe(
      rub(750),
    );
    expect(
      kosmLines
        .filter((l) => l.kind === "surplus")
        .reduce((s, l) => s + l.amount, 0),
    ).toBe(rub(3725));
    expect(balanceAfter(demoEnvelopes(), plan.lines, "Косметология")).toBe(
      rub(-22925),
    );
  });

  it("full envelopes themselves receive nothing", () => {
    for (const id of ["w2e1", "w2e4", "w2e5", "w2e6"]) {
      expect(plan.lines.filter((l) => l.envelopeId === id)).toEqual([]);
    }
  });

  it("surplus lines remember the source envelope", () => {
    const sources = plan.lines
      .filter((l) => l.envelopeId === "w2e2" && l.kind === "surplus")
      .map((l) => [l.sourceEnvelopeId, l.amount]);
    expect(sources).toEqual([
      ["w2e1", rub(1500)],
      ["w2e4", rub(1300)],
      ["w2e5", rub(225)],
      ["w2e6", rub(700)],
    ]);
  });

  it("wallet total stays 5 925, same as its contributions per income", () => {
    const selfCareEnvelopeIds = new Set(
      demoEnvelopes()
        .filter((e) => e.walletId === "w2")
        .map((e) => e.id),
    );
    const total = plan.lines
      .filter((l) => selfCareEnvelopeIds.has(l.envelopeId))
      .reduce((s, l) => s + l.amount, 0);
    expect(total).toBe(rub(5925));
  });
});

describe("surplus larger than the receiver needs", () => {
  it("the receiver keeps the whole surplus above its ceiling", () => {
    // A is full and gives 500 to B; B's ceiling is 800, own 400 → 900.
    const envelopes = [
      env("a", 1, 1000, 1000),
      env("b", 2, 800, 0),
      env("c", 3, 5000, 0, 3),
    ];
    const plan = planAllocation(
      [{ id: "w", name: "W", order: 1 }],
      envelopes,
      rub(10000),
    );
    expect(sumFor(plan.lines, "b")).toBe(rub(900));
    expect(sumFor(plan.lines, "b")).toBeGreaterThan(rub(800));
    expect(sumFor(plan.lines, "c")).toBe(rub(2500));
    expect(sumFor(plan.lines, "a")).toBe(0);
    const surplus = planWallet(envelopes).surplus!;
    expect(surplus.receivers).toEqual([
      { envelopeId: "b", name: "B", amount: rub(500) },
    ]);
  });

  it("all envelopes full → each keeps its own contribution above the ceiling", () => {
    const wallets = [{ id: "w", name: "W", order: 1 }];
    const envelopes = [env("a", 1, 1000, 1000), env("b", 2, 500, 700)];
    const plan = planAllocation(wallets, envelopes, rub(10000));
    expect(plan.lines).toEqual([
      expect.objectContaining({
        envelopeId: "a",
        amount: rub(500),
        kind: "contribution",
      }),
      expect.objectContaining({
        envelopeId: "b",
        amount: rub(250),
        kind: "contribution",
      }),
    ]);
    expect(plan.toEnvelopes).toBe(rub(750));
    expect(plan.toDaily).toBe(rub(9250));
    expect(plan.surpluses).toEqual([
      expect.objectContaining({
        walletName: "W",
        allFull: true,
        receivers: [],
      }),
    ]);
  });
});

describe("income smaller than all contributions: choosing wallets", () => {
  it("20 000, all wallets checked: wallet order, 0 daily, short 10 775", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(20000));
    expect(plan.needsChoice).toBe(true);
    expect(plan.allSelected).toBe(true);
    expect(plan.byWallet.map((w) => [w.name, w.amount])).toEqual([
      ["Clothes", rub(4800)],
      ["Self-care", rub(5925)],
      ["Miscellaneous", rub(6550)],
      ["Long term", rub(2725)],
      ["Goals WB", 0],
    ]);
    expect(plan.toEnvelopes).toBe(rub(20000));
    expect(plan.toDaily).toBe(0);
    expect(plan.shortage).toBe(rub(10775));
  });

  it("20 000 without Long term and Goals WB: the rest, 2 725, goes to daily", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(20000), [
      "w5",
      "w6",
    ]);
    expect(plan.byWallet.map((w) => [w.name, w.amount])).toEqual([
      ["Clothes", rub(4800)],
      ["Self-care", rub(5925)],
      ["Miscellaneous", rub(6550)],
      ["Long term", 0],
      ["Goals WB", 0],
    ]);
    expect(plan.toEnvelopes).toBe(rub(17275));
    expect(plan.toDaily).toBe(rub(2725));
    expect(plan.shortage).toBe(0);
    expect(plan.allSelected).toBe(false);
  });

  it("20 000 without Clothes: not enough for the checked, short 5 975", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(20000), [
      "w1",
    ]);
    expect(plan.byWallet.map((w) => [w.name, w.amount])).toEqual([
      ["Clothes", 0],
      ["Self-care", rub(5925)],
      ["Miscellaneous", rub(6550)],
      ["Long term", rub(5700)],
      ["Goals WB", rub(1825)],
    ]);
    expect(plan.toDaily).toBe(0);
    expect(plan.shortage).toBe(rub(5975));
    expect(plan.allSelected).toBe(false);
  });

  it("4 600: Clothes first, «Одежда» 4 500, then «Украшения» 100", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(4600));
    expect(plan.lines).toEqual([
      expect.objectContaining({ envelopeId: "w1e1", amount: rub(4500) }),
      expect.objectContaining({ envelopeId: "w1e2", amount: rub(100) }),
    ]);
  });

  it("enough income: unchecked wallets are ignored", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(150000), [
      "w1",
    ]);
    expect(plan.needsChoice).toBe(false);
    expect(plan.toEnvelopes).toBe(rub(30775));
  });
});

describe("edge cases", () => {
  it("zero income allocates nothing", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), 0);
    expect(plan.lines).toEqual([]);
    expect(plan.toDaily).toBe(0);
    expect(plan.shortage).toBe(rub(30775));
  });

  it("allocation always adds up to the income", () => {
    for (const income of [rub(1), rub(30775), rub(30774.99), rub(300000)]) {
      const plan = planAllocation(demoWallets(), demoEnvelopes(), income);
      expect(plan.toEnvelopes + plan.toDaily).toBe(income);
    }
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(20000), [
      "w1",
      "w6",
    ]);
    expect(plan.toEnvelopes + plan.toDaily).toBe(rub(20000));
  });
});

describe("balances include transfers", () => {
  // 2 500 moved from «Подушка» (17 000) to «Подарки» (24 500): the transfer
  // is part of the balance, so allocation sees «Подарки» as full.
  const envelopes = demoEnvelopes().map((e) => {
    if (e.name === "Подарки") return { ...e, balance: rub(27000) };
    if (e.name === "Подушка") return { ...e, balance: rub(14500) };
    return e;
  });
  const plan = planAllocation(demoWallets(), envelopes, rub(150000));
  const id = (name: string) => envelopes.find((e) => e.name === name)!.id;

  it("«Подарки» become full and give their 2 250 to «Технику»", () => {
    expect(sumFor(plan.lines, id("Подарки"))).toBe(0);
    expect(sumFor(plan.lines, id("Техника"))).toBe(rub(900 + 2250));
  });

  it("Miscellaneous still gets 6 550, 30 775 go to envelopes in total", () => {
    const misc = envelopes
      .filter((e) =>
        ["Техника", "Быт", "Подарки", "Развлечения"].includes(e.name),
      )
      .reduce((s, e) => s + sumFor(plan.lines, e.id), 0);
    expect(misc).toBe(rub(6550));
    expect(plan.toEnvelopes).toBe(rub(30775));
    expect(plan.toDaily).toBe(rub(119225));
  });
});
