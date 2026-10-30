import { describe, expect, it } from "vitest";
import {
  countEnvelopes,
  countTimes,
  formatDay,
  formatFrequency,
  formatRelativeDay,
} from "./text";

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
});
