import { describe, expect, it } from "vitest";
import {
  countEnvelopes,
  countTimes,
  formatDay,
  formatFrequency,
  formatRelativeDay,
  monthNamePrepositional,
  transferLabel,
} from "./text";
import type { TransferSide } from "@/domain/transfer";

describe("text helpers", () => {
  it("pluralizes in Russian", () => {
    expect(countEnvelopes(1)).toBe("1 конверт");
    expect(countEnvelopes(3)).toBe("3 конверта");
    expect(countEnvelopes(9)).toBe("9 конвертов");
    expect(countEnvelopes(11)).toBe("11 конвертов");
    expect(countEnvelopes(21)).toBe("21 конверт");
    expect(countTimes(2)).toBe("2 раза");
    expect(countTimes(5)).toBe("5 раз");
  });

  it("formats frequency", () => {
    expect(formatFrequency(2, "month")).toBe("раз в 2 месяца");
    expect(formatFrequency(1, "month")).toBe("раз в месяц");
    expect(formatFrequency(2, "week")).toBe("раз в 2 недели");
    expect(formatFrequency(5, "year")).toBe("раз в 5 лет");
  });

  it("formats days", () => {
    expect(formatDay("2026-11-05", "2026-10-21")).toBe("5 ноября");
    expect(formatDay("2027-01-05", "2026-10-21")).toBe("5 января 2027");
    expect(formatRelativeDay("2026-10-21", "2026-10-21")).toBe("сегодня");
    expect(formatRelativeDay("2026-10-20", "2026-10-21")).toBe("вчера");
    expect(formatRelativeDay("2026-09-18", "2026-10-21")).toBe("18 сентября");
    expect(formatRelativeDay("2026-02-28", "2026-03-01")).toBe("вчера");
  });

  it("names the month in the prepositional case", () => {
    expect(monthNamePrepositional("2026-11-05")).toBe("в ноябре");
    expect(monthNamePrepositional("2026-12-01")).toBe("в декабре");
    expect(monthNamePrepositional("2027-05-31")).toBe("в мае");
  });
});

describe("transferLabel", () => {
  const side = (id: string): TransferSide => ({
    kind: "envelope",
    envelopeId: id,
  });
  const daily: TransferSide = { kind: "daily" };
  const deleted: TransferSide = { kind: "deleted" };
  const t = (
    from: TransferSide,
    to: TransferSide,
    fromName: string | null,
    toName: string | null,
  ) => ({ from, to, fromName, toName });

  it("between envelopes, seen from each side", () => {
    const x = t(side("m"), side("c"), "Маникюр", "Одежда");
    expect(transferLabel(x, side("m"))).toBe("В конверт «Одежда»");
    expect(transferLabel(x, side("c"))).toBe("Из конверта «Маникюр»");
  });

  it("a top-up of «на жизнь»", () => {
    const x = t(side("m"), daily, "Маникюр", null);
    expect(transferLabel(x, daily)).toBe("Из конверта «Маникюр»");
    expect(transferLabel(x, side("m"))).toBe("На жизнь");
  });

  it("from «на жизнь» into an envelope", () => {
    const x = t(daily, side("p"), null, "Подушка");
    expect(transferLabel(x, daily)).toBe("В конверт «Подушка»");
    expect(transferLabel(x, side("p"))).toBe("Из денег на жизнь");
  });

  it("a deleted envelope on the other side", () => {
    const from = t(deleted, side("m"), null, "Маникюр");
    expect(transferLabel(from, side("m"))).toBe("Из удалённого конверта");
    const to = t(side("m"), deleted, "Маникюр", null);
    expect(transferLabel(to, side("m"))).toBe("В удалённый конверт");
  });
});
