/**
 * Money is always an integer number of kopecks.
 * This is the only module that rounds: rounding happens only on division.
 */

const NBSP = " ";
const MINUS = "−";

function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer, got ${value}`);
  }
}

/** Integer division rounded half away from zero. */
export function divRound(dividend: number, divisor: number): number {
  assertInteger(dividend, "dividend");
  assertInteger(divisor, "divisor");
  if (divisor === 0) throw new Error("Division by zero");
  const sign = Math.sign(dividend) * Math.sign(divisor);
  const a = Math.abs(dividend);
  const b = Math.abs(divisor);
  const quotient = Math.floor(a / b);
  const remainder = a - quotient * b;
  const rounded = remainder * 2 >= b ? quotient + 1 : quotient;
  return sign * rounded || 0;
}

/** Integer division rounded down (for "how many whole times"). */
export function divFloor(dividend: number, divisor: number): number {
  assertInteger(dividend, "dividend");
  assertInteger(divisor, "divisor");
  if (divisor === 0) throw new Error("Division by zero");
  return Math.floor(dividend / divisor);
}

/** Rounds kopecks to whole rubles. */
export function roundToRubles(kopecks: number): number {
  return divRound(kopecks, 100) * 100;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 6677000 → "66 770 ₽" (non-breaking spaces), −35000 → "−350 ₽". */
export function formatMoney(
  kopecks: number,
  options: { currency?: boolean } = {},
): string {
  assertInteger(kopecks, "kopecks");
  const { currency = true } = options;
  const abs = Math.abs(kopecks);
  const rubles = Math.floor(abs / 100);
  const cents = abs % 100;
  let text = groupThousands(String(rubles));
  if (cents !== 0) text += `,${String(cents).padStart(2, "0")}`;
  if (kopecks < 0) text = MINUS + text;
  return currency ? `${text}${NBSP}₽` : text;
}

/** Formats kopecks for an input field: "1 500,50" without the currency sign. */
export function formatMoneyInput(kopecks: number | null): string {
  if (kopecks === null) return "";
  return formatMoney(kopecks, { currency: false }).replaceAll(NBSP, " ");
}

/** "1 500,50 ₽" → 150050. Returns null for empty or invalid input. */
export function parseMoney(input: string): number | null {
  const cleaned = input
    .replace(/[\s  ₽]/g, "")
    .replace(MINUS, "-")
    .replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, rubles, cents = ""] = match;
  const value = Number(rubles) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(value)) return null;
  return sign === "-" ? -value : value;
}
