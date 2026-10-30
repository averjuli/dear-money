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

describe("preview: salary 150 000 with demo data", () => {
  const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(150000));

  it("63 750 to envelopes, 86 250 to daily spending", () => {
    expect(plan.toEnvelopes).toBe(rub(63750));
    expect(plan.toDaily).toBe(rub(86250));
    expect(plan.shortage).toBe(0);
  });

  it("per wallet, largest first", () => {
    expect(plan.wallets.map((w) => [w.name, w.amount])).toEqual([
      ["Goals WB", rub(15600)],
      ["Miscellaneous", rub(13100)],
      ["Self-care", rub(11850)],
      ["Long term", rub(11400)],
      ["Clothes", rub(9600)],
      ["Запасные", rub(2200)],
    ]);
  });
});

describe("surplus in Self-care", () => {
  const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(150000));
  const selfCare = plan.surpluses.find((s) => s.walletName === "Self-care")!;

  it("full envelopes give 3 000 + 2 600 + 450 + 1 400 = 7 450 to «Косметология»", () => {
    expect(selfCare.fullEnvelopeNames).toEqual([
      "Здоровье",
      "Маникюр",
      "Стрижка",
      "Косметика",
    ]);
    expect(selfCare.amount).toBe(rub(7450));
    expect(selfCare.receivers).toEqual([
      { envelopeId: "w2e2", name: "Косметология", amount: rub(7450) },
    ]);
    expect(selfCare.toDaily).toBe(0);
  });

  it("«Косметология» gets 1 500 + 7 450 = 8 950: −27 400 → −18 450", () => {
    const kosmLines = plan.lines.filter((l) => l.envelopeId === "w2e2");
    expect(kosmLines.reduce((s, l) => s + l.amount, 0)).toBe(rub(8950));
    expect(kosmLines.find((l) => l.kind === "contribution")?.amount).toBe(
      rub(1500),
    );
    expect(
      kosmLines
        .filter((l) => l.kind === "surplus")
        .reduce((s, l) => s + l.amount, 0),
    ).toBe(rub(7450));
    expect(balanceAfter(demoEnvelopes(), plan.lines, "Косметология")).toBe(
      rub(-18450),
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
      ["w2e1", rub(3000)],
      ["w2e4", rub(2600)],
      ["w2e5", rub(450)],
      ["w2e6", rub(1400)],
    ]);
  });

  it("wallet total stays 11 850, same as its contributions", () => {
    const selfCareEnvelopeIds = new Set(
      demoEnvelopes()
        .filter((e) => e.walletId === "w2")
        .map((e) => e.id),
    );
    const total = plan.lines
      .filter((l) => selfCareEnvelopeIds.has(l.envelopeId))
      .reduce((s, l) => s + l.amount, 0);
    expect(total).toBe(rub(11850));
  });
});

describe("surplus larger than the receiver needs", () => {
  const settings = {
    periodN: 1,
    periodUnit: "month" as const,
    contributionOverride: null,
    timesToSave: 1,
  };

  it("overflow passes to the next non-full envelope by priority", () => {
    const envelopes: AllocationEnvelope[] = [
      {
        ...settings,
        id: "a",
        walletId: "w",
        name: "A",
        priority: 1,
        costPerTime: rub(1000),
        balance: rub(1000),
      },
      {
        ...settings,
        id: "b",
        walletId: "w",
        name: "B",
        priority: 2,
        costPerTime: rub(500),
        balance: rub(0),
      },
      {
        ...settings,
        id: "c",
        walletId: "w",
        name: "C",
        priority: 3,
        costPerTime: rub(5000),
        balance: rub(0),
        timesToSave: 3,
      },
    ];
    const result = planWallet(envelopes);
    // A is full and gives 1 000; B needs only 0 after its own 500 → C gets it.
    expect(result.surplus?.receivers).toEqual([
      { envelopeId: "c", name: "C", amount: rub(1000) },
    ]);
  });

  it("splits the surplus when the receiver fills up", () => {
    const envelopes: AllocationEnvelope[] = [
      {
        ...settings,
        id: "a",
        walletId: "w",
        name: "A",
        priority: 1,
        costPerTime: rub(1000),
        balance: rub(1000),
      },
      {
        ...settings,
        id: "b",
        walletId: "w",
        name: "B",
        priority: 2,
        costPerTime: rub(800),
        balance: rub(0),
      },
      {
        ...settings,
        id: "c",
        walletId: "w",
        name: "C",
        priority: 3,
        costPerTime: rub(5000),
        balance: rub(0),
        timesToSave: 3,
      },
    ];
    const result = planWallet(envelopes);
    // B: 800 own, ceiling 800 → room 0. Make B's ceiling larger to see a split:
    expect(result.surplus?.receivers).toEqual([
      { envelopeId: "c", name: "C", amount: rub(1000) },
    ]);

    const roomy = envelopes.map((e) =>
      e.id === "b" ? { ...e, timesToSave: 2 } : e,
    );
    // B ceiling 1 600, own 800 → room 800; C gets the remaining 200.
    expect(planWallet(roomy).surplus?.receivers).toEqual([
      { envelopeId: "b", name: "B", amount: rub(800) },
      { envelopeId: "c", name: "C", amount: rub(200) },
    ]);
  });

  it("all envelopes full → the whole wallet goes to daily spending", () => {
    const wallets = [{ id: "w", name: "W", order: 1 }];
    const envelopes: AllocationEnvelope[] = [
      {
        ...settings,
        id: "a",
        walletId: "w",
        name: "A",
        priority: 1,
        costPerTime: rub(1000),
        balance: rub(1000),
      },
      {
        ...settings,
        id: "b",
        walletId: "w",
        name: "B",
        priority: 2,
        costPerTime: rub(500),
        balance: rub(700),
      },
    ];
    const plan = planAllocation(wallets, envelopes, rub(10000));
    expect(plan.toEnvelopes).toBe(0);
    expect(plan.toDaily).toBe(rub(10000));
    expect(plan.lines).toEqual([]);
    expect(plan.surpluses).toEqual([
      expect.objectContaining({
        walletName: "W",
        amount: rub(1500),
        receivers: [],
        toDaily: rub(1500),
      }),
    ]);
  });
});

describe("income smaller than all contributions", () => {
  it("40 000 with 63 750 of contributions: all to envelopes, 0 daily, short 23 750", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(40000));
    expect(plan.toEnvelopes).toBe(rub(40000));
    expect(plan.toDaily).toBe(0);
    expect(plan.shortage).toBe(rub(23750));
    expect(plan.lines.reduce((s, l) => s + l.amount, 0)).toBe(rub(40000));
  });

  it("funds wallets in their order and envelopes by priority", () => {
    // Clothes (order 1) needs 9 600: «Одежда» 9 000 first, then «Украшения».
    const plan = planAllocation(demoWallets(), demoEnvelopes(), rub(9200));
    expect(plan.lines).toEqual([
      expect.objectContaining({ envelopeId: "w1e1", amount: rub(9000) }),
      expect.objectContaining({ envelopeId: "w1e2", amount: rub(200) }),
    ]);
  });
});

describe("edge cases", () => {
  it("zero income allocates nothing", () => {
    const plan = planAllocation(demoWallets(), demoEnvelopes(), 0);
    expect(plan.lines).toEqual([]);
    expect(plan.toDaily).toBe(0);
    expect(plan.shortage).toBe(rub(63750));
  });

  it("allocation always adds up to the income", () => {
    for (const income of [rub(1), rub(63750), rub(63749.99), rub(300000)]) {
      const plan = planAllocation(demoWallets(), demoEnvelopes(), income);
      expect(plan.toEnvelopes + plan.toDaily).toBe(income);
    }
  });
});
