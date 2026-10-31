import { describe, expect, it } from "vitest";
import { mainEnvelopes, moveItem } from "./priority";
import { demoEnvelopes, demoWallets } from "./test-fixtures";

function demoWalletEnvelopes(walletName: string) {
  const wallet = demoWallets().find((w) => w.name === walletName)!;
  return demoEnvelopes().filter((e) => e.walletId === wallet.id);
}

describe("mainEnvelopes", () => {
  it("Self-care: first three by priority and «ещё 6»; Брови stays out", () => {
    const { shown, more } = mainEnvelopes(demoWalletEnvelopes("Self-care"));
    expect(shown.map((e) => e.name)).toEqual([
      "Здоровье",
      "Косметология",
      "Стоматолог",
    ]);
    expect(more).toBe(6);
  });

  it("Запасные: one envelope, nothing more", () => {
    const { shown, more } = mainEnvelopes(demoWalletEnvelopes("Запасные"));
    expect(shown.map((e) => e.name)).toEqual(["Запасные"]);
    expect(more).toBe(0);
  });

  it("follows priority, not the input order", () => {
    const { shown } = mainEnvelopes([
      { name: "c", priority: 3 },
      { name: "a", priority: 1 },
      { name: "d", priority: 4 },
      { name: "b", priority: 2 },
    ]);
    expect(shown.map((e) => e.name)).toEqual(["a", "b", "c"]);
  });
});

describe("moveItem", () => {
  it("dragging «Маникюр» from 4th to 1st shifts the rest down without gaps", () => {
    const order = [
      "Здоровье",
      "Косметология",
      "Стоматолог",
      "Маникюр",
      "Стрижка",
    ];
    expect(moveItem(order, 3, 0)).toEqual([
      "Маникюр",
      "Здоровье",
      "Косметология",
      "Стоматолог",
      "Стрижка",
    ]);
  });

  it("moves down as well", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("ignores out-of-range indexes", () => {
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
