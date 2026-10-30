import { describe, expect, it } from "vitest";
import { divRound, formatMoney, parseMoney } from "./money";

const NBSP = " ";

describe("divRound", () => {
  it("rounds half up to the nearest kopeck", () => {
    expect(divRound(5_200_000, 24)).toBe(216_667);
    expect(divRound(300_000, 2)).toBe(150_000);
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(4, 3)).toBe(1);
  });

  it("rounds negative values symmetrically", () => {
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(-4, 3)).toBe(-1);
  });

  it("rejects non-integer input and zero divisor", () => {
    expect(() => divRound(1.5, 2)).toThrow();
    expect(() => divRound(1, 0)).toThrow();
  });
});

describe("formatMoney", () => {
  it("groups thousands with a non-breaking space", () => {
    expect(formatMoney(6_677_000)).toBe(`66${NBSP}770${NBSP}₽`);
  });

  it("uses a real minus sign", () => {
    expect(formatMoney(-35_000)).toBe(`−350${NBSP}₽`);
  });

  it("shows kopecks only when present", () => {
    expect(formatMoney(216_667)).toBe(`2${NBSP}166,67${NBSP}₽`);
    expect(formatMoney(150_050)).toBe(`1${NBSP}500,50${NBSP}₽`);
    expect(formatMoney(0)).toBe(`0${NBSP}₽`);
  });

  it("can omit the currency sign", () => {
    expect(formatMoney(1_560_000, { currency: false })).toBe(`15${NBSP}600`);
  });
});

describe("parseMoney", () => {
  it("parses rubles with spaces and comma or dot decimals", () => {
    expect(parseMoney("150 000")).toBe(15_000_000);
    expect(parseMoney("1 500,50")).toBe(150_050);
    expect(parseMoney("4200.5")).toBe(420_050);
    expect(parseMoney(`3${NBSP}000 ₽`)).toBe(300_000);
  });

  it("parses negative values", () => {
    expect(parseMoney("−27 400")).toBe(-2_740_000);
    expect(parseMoney("-350")).toBe(-35_000);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("  ")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1,234,5")).toBeNull();
    expect(parseMoney("1,555")).toBeNull();
  });
});
