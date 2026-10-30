import { describe, expect, it } from "vitest";
import sampleSeed from "../../data/sample-seed.json";
import { planAllocation } from "./allocation";
import { sampleEnvelopes, sampleWallets, rub } from "./test-fixtures";

// The sample data used to try the app in the browser must reproduce
// the success criteria from specs/01-продуктовая-идея.md.
describe("sample seed", () => {
  it("has 5 wallets with 1 to 5 envelopes each and no expenses", () => {
    expect(sampleSeed.wallets).toHaveLength(5);
    for (const wallet of sampleSeed.wallets) {
      const count = sampleSeed.envelopes.filter(
        (e) => e.walletId === wallet.id,
      ).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(sampleSeed.expenses).toEqual([]);
  });

  it("salary 150 000 → 63 750 to envelopes, 86 250 daily, 7 450 surplus to «Косметология»", () => {
    const plan = planAllocation(
      sampleWallets(),
      sampleEnvelopes(),
      rub(150000),
    );
    expect(plan.toEnvelopes).toBe(rub(63750));
    expect(plan.toDaily).toBe(rub(86250));
    const selfCare = plan.surpluses.find((s) => s.walletName === "Self-care");
    expect(selfCare?.amount).toBe(rub(7450));
    expect(selfCare?.receivers.map((r) => r.name)).toEqual(["Косметология"]);
  });

  it("«Маникюр» holds 12 600 with cost 4 200; «Транспорт» limit is 4 000", () => {
    const manicure = sampleEnvelopes().find((e) => e.name === "Маникюр");
    expect(manicure?.balance).toBe(rub(12600));
    expect(manicure?.costPerTime).toBe(rub(4200));
    const transport = sampleSeed.spendCategories.find(
      (c) => c.name === "Транспорт",
    );
    expect(transport?.monthlyLimit).toBe(rub(4000));
  });
});
