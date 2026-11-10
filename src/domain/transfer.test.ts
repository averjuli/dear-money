import { describe, expect, it } from "vitest";
import { dailyMove } from "./daily";
import { rub } from "./test-fixtures";
import {
  canTransfer,
  signedAmount,
  transferDailyEffect,
  transferHint,
  withoutTransfer,
  type SavedTransfer,
  type TransferSide,
} from "./transfer";

const env = (envelopeId: string): TransferSide => ({
  kind: "envelope",
  envelopeId,
});
const daily: TransferSide = { kind: "daily" };
const deleted: TransferSide = { kind: "deleted" };

const base = {
  amount: rub(4200),
  from: env("manicure") as TransferSide | null,
  to: env("clothes") as TransferSide | null,
  date: "2026-11-10",
  today: "2026-11-10",
  dailyAvailable: true,
  initial: null as SavedTransfer | null,
};

describe("canTransfer", () => {
  it("a normal envelope → envelope transfer", () => {
    expect(canTransfer(base)).toBe(true);
  });

  it("empty or zero amount is not allowed", () => {
    expect(canTransfer({ ...base, amount: 0 })).toBe(false);
    expect(canTransfer({ ...base, amount: Number.NaN })).toBe(false);
  });

  it("both sides must be chosen", () => {
    expect(canTransfer({ ...base, from: null })).toBe(false);
    expect(canTransfer({ ...base, to: null })).toBe(false);
  });

  it("the same envelope on both sides is not allowed", () => {
    expect(canTransfer({ ...base, to: env("manicure") })).toBe(false);
  });

  it("«на жизнь» on both sides is not allowed", () => {
    expect(canTransfer({ ...base, from: daily, to: daily })).toBe(false);
  });

  it("«на жизнь» without an allocated income is not allowed on either side", () => {
    expect(canTransfer({ ...base, to: daily, dailyAvailable: false })).toBe(
      false,
    );
    expect(canTransfer({ ...base, from: daily, dailyAvailable: false })).toBe(
      false,
    );
  });

  it("envelope → envelope works without an allocated income", () => {
    expect(canTransfer({ ...base, dailyAvailable: false })).toBe(true);
  });

  it("«на жизнь» with an allocated income works", () => {
    expect(canTransfer({ ...base, to: daily })).toBe(true);
    expect(canTransfer({ ...base, from: daily })).toBe(true);
  });

  it("today and a past day are allowed, tomorrow is not", () => {
    expect(canTransfer({ ...base, date: "2026-11-10" })).toBe(true);
    expect(canTransfer({ ...base, date: "2026-11-05" })).toBe(true);
    expect(canTransfer({ ...base, date: "2026-11-11" })).toBe(false);
  });

  it("a malformed date is not allowed", () => {
    expect(canTransfer({ ...base, date: "" })).toBe(false);
    expect(canTransfer({ ...base, date: "10.11.2026" })).toBe(false);
  });

  it("a deleted envelope cannot be picked in a new transfer", () => {
    expect(canTransfer({ ...base, from: deleted })).toBe(false);
  });

  it("a deleted envelope stays only on the side where it was", () => {
    const initial: SavedTransfer = {
      amount: rub(1100),
      from: deleted,
      to: env("manicure"),
    };
    expect(
      canTransfer({ ...base, from: deleted, to: env("manicure"), initial }),
    ).toBe(true);
    expect(
      canTransfer({
        ...base,
        from: env("pillow"),
        to: env("manicure"),
        initial,
      }),
    ).toBe(true);
    // The deleted envelope may not jump to the other side.
    expect(
      canTransfer({ ...base, from: env("pillow"), to: deleted, initial }),
    ).toBe(false);
  });
});

describe("signedAmount", () => {
  const t: SavedTransfer = {
    amount: rub(4200),
    from: env("manicure"),
    to: env("clothes"),
  };

  it("4 200 «Маникюр» → «Одежда»: −4 200 for the source, +4 200 for the target", () => {
    expect(signedAmount(t, env("manicure"))).toBe(rub(-4200));
    expect(signedAmount(t, env("clothes"))).toBe(rub(4200));
  });

  it("another envelope is not touched", () => {
    expect(signedAmount(t, env("pillow"))).toBe(0);
    expect(signedAmount(t, daily)).toBe(0);
  });

  it("a top-up of 5 000: +5 000 for «на жизнь», −5 000 for «Маникюр»", () => {
    const top: SavedTransfer = {
      amount: rub(5000),
      from: env("manicure"),
      to: daily,
    };
    expect(signedAmount(top, daily)).toBe(rub(5000));
    expect(signedAmount(top, env("manicure"))).toBe(rub(-5000));
  });

  it("a transfer from a deleted envelope: +1 100 for the target", () => {
    const t2: SavedTransfer = {
      amount: rub(1100),
      from: deleted,
      to: env("manicure"),
    };
    expect(signedAmount(t2, env("manicure"))).toBe(rub(1100));
  });
});

describe("withoutTransfer", () => {
  const initial: SavedTransfer = {
    amount: rub(4200),
    from: env("manicure"),
    to: env("clothes"),
  };

  it("«Маникюр» 8 400 → 12 600, «Одежда» 10 600 → 6 400 without the transfer", () => {
    expect(withoutTransfer(rub(8400), env("manicure"), initial)).toBe(
      rub(12600),
    );
    expect(withoutTransfer(rub(10600), env("clothes"), initial)).toBe(
      rub(6400),
    );
  });

  it("a new transfer (nothing saved) changes nothing", () => {
    expect(withoutTransfer(rub(8400), env("manicure"), null)).toBe(rub(8400));
  });
});

describe("dailyMove for transfers", () => {
  const top = (amount: number): SavedTransfer => ({
    amount: rub(amount),
    from: env("manicure"),
    to: daily,
  });
  const out = (amount: number): SavedTransfer => ({
    amount: rub(amount),
    from: daily,
    to: env("pillow"),
  });
  const between: SavedTransfer = {
    amount: rub(4200),
    from: env("manicure"),
    to: env("clothes"),
  };
  const move = (after: SavedTransfer | null, journaled: number) =>
    dailyMove({ effect: transferDailyEffect(after), journaled });

  it("new top-up 5 000 → +5 000", () => {
    expect(move(top(5000), 0)).toBe(rub(5000));
  });

  it("new transfer 6 770 from «на жизнь» → −6 770", () => {
    expect(move(out(6770), 0)).toBe(rub(-6770));
  });

  it("top-up edited 5 000 → 6 000 → +1 000", () => {
    expect(move(top(6000), rub(5000))).toBe(rub(1000));
  });

  it("only the date changed → 0", () => {
    expect(move(top(5000), rub(5000))).toBe(0);
  });

  it("top-up 5 000 deleted → −5 000", () => {
    expect(move(null, rub(5000))).toBe(rub(-5000));
  });

  it("transfer of 6 770 from «на жизнь» deleted → +6 770", () => {
    expect(move(null, rub(-6770))).toBe(rub(6770));
  });

  it("top-up turned into an envelope transfer → −5 000", () => {
    expect(move(between, rub(5000))).toBe(rub(-5000));
  });

  it("an envelope transfer turned into a top-up → +5 000", () => {
    expect(move(top(5000), 0)).toBe(rub(5000));
  });

  it("an envelope transfer, new, edited or deleted → 0", () => {
    expect(move(between, 0)).toBe(0);
    expect(move(null, 0)).toBe(0);
  });
});

describe("transferHint", () => {
  const envelopes = new Map([
    ["manicure", { balance: rub(12600), costPerTime: rub(4200) }],
    ["cosmetology", { balance: rub(-27400), costPerTime: rub(9000) }],
    ["pillow", { balance: rub(17000), costPerTime: rub(11000) }],
    ["gifts", { balance: rub(24500), costPerTime: rub(9000) }],
    ["brows", { balance: rub(1100), costPerTime: rub(1100) }],
    ["clothes", { balance: rub(6400), costPerTime: rub(18000) }],
  ]);
  const lookup = (id: string) => envelopes.get(id);
  const input = {
    lookup,
    dailyRemaining: rub(66770) as number | null,
    initial: null as SavedTransfer | null,
    journaledDaily: 0,
  };

  it("4 200 «Маникюр» → «Косметология»: 8 400 (2 times), −23 200 in minus", () => {
    const h = transferHint({
      ...input,
      amount: rub(4200),
      from: env("manicure"),
      to: env("cosmetology"),
    });
    expect(h.from).toEqual({
      kind: "envelope",
      envelopeId: "manicure",
      newBalance: rub(8400),
      times: 2,
      negative: false,
    });
    expect(h.to).toEqual({
      kind: "envelope",
      envelopeId: "cosmetology",
      newBalance: rub(-23200),
      times: 0,
      negative: true,
    });
  });

  it("2 500 «Подушка» → «Подарки»: «Подарки» 27 000, 3 times", () => {
    const h = transferHint({
      ...input,
      amount: rub(2500),
      from: env("pillow"),
      to: env("gifts"),
    });
    expect(h.to).toMatchObject({ newBalance: rub(27000), times: 3 });
    expect(h.from).toMatchObject({ newBalance: rub(14500) });
  });

  it("5 000 «Маникюр» → «на жизнь» with 66 770 left: 71 770", () => {
    const h = transferHint({
      ...input,
      amount: rub(5000),
      from: env("manicure"),
      to: daily,
    });
    expect(h.to).toEqual({
      kind: "daily",
      remaining: rub(71770),
      negative: false,
    });
  });

  it("70 000 from «на жизнь» with 66 770 left: −3 230 in minus", () => {
    const h = transferHint({
      ...input,
      amount: rub(70000),
      from: daily,
      to: env("pillow"),
    });
    expect(h.from).toEqual({
      kind: "daily",
      remaining: rub(-3230),
      negative: true,
    });
  });

  it("1 450 from «Брови» with 1 100: −350, minus", () => {
    const h = transferHint({
      ...input,
      amount: rub(1450),
      from: env("brows"),
      to: env("manicure"),
    });
    expect(h.from).toMatchObject({ newBalance: rub(-350), negative: true });
  });

  it("editing: a saved 4 200 «Маникюр» → «Одежда» changed to 2 000", () => {
    // Stored balances already include the saved transfer.
    const after = new Map(envelopes);
    after.set("manicure", { balance: rub(8400), costPerTime: rub(4200) });
    after.set("clothes", { balance: rub(10600), costPerTime: rub(18000) });
    const initial: SavedTransfer = {
      amount: rub(4200),
      from: env("manicure"),
      to: env("clothes"),
    };
    const unchanged = transferHint({
      ...input,
      lookup: (id) => after.get(id),
      initial,
      amount: rub(4200),
      from: env("manicure"),
      to: env("clothes"),
    });
    expect(unchanged.from).toMatchObject({ newBalance: rub(8400), times: 2 });
    expect(unchanged.to).toMatchObject({ newBalance: rub(10600) });

    const edited = transferHint({
      ...input,
      lookup: (id) => after.get(id),
      initial,
      amount: rub(2000),
      from: env("manicure"),
      to: env("clothes"),
    });
    expect(edited.from).toMatchObject({ newBalance: rub(10600), times: 2 });
    expect(edited.to).toMatchObject({ newBalance: rub(8400) });
  });

  it("editing a top-up 5 000 → 6 000 with 71 770 left: 72 770", () => {
    const initial: SavedTransfer = {
      amount: rub(5000),
      from: env("manicure"),
      to: daily,
    };
    const h = transferHint({
      ...input,
      dailyRemaining: rub(71770),
      initial,
      journaledDaily: rub(5000),
      amount: rub(6000),
      from: env("manicure"),
      to: daily,
    });
    expect(h.to).toEqual({
      kind: "daily",
      remaining: rub(72770),
      negative: false,
    });
  });

  it("a deleted side has no hint, an unchosen side has none", () => {
    const initial: SavedTransfer = {
      amount: rub(1100),
      from: deleted,
      to: env("manicure"),
    };
    const h = transferHint({
      ...input,
      initial,
      amount: rub(800),
      from: deleted,
      to: env("manicure"),
    });
    expect(h.from).toBeNull();
    expect(h.to).toMatchObject({ kind: "envelope" });
    const none = transferHint({
      ...input,
      amount: rub(800),
      from: null,
      to: null,
    });
    expect(none).toEqual({ from: null, to: null });
  });
});
