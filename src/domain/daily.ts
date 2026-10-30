import { divRound, roundToRubles } from "./money";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parses "YYYY-MM-DD" as a calendar day (UTC midnight). */
function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Days from today up to (not including) the given date, today included. */
export function daysUntil(today: string, date: string): number {
  return dayNumber(date) - dayNumber(today);
}

export interface DailySummary {
  budget: number;
  spent: number;
  remaining: number;
  daysLeft: number | null;
  /** Rounded to whole rubles; null when there is no future income date. */
  perDay: number | null;
}

export function dailySummary(input: {
  budget: number;
  spent: number;
  today: string;
  nextIncomeDate: string | null;
}): DailySummary {
  const remaining = input.budget - input.spent;
  const daysLeft =
    input.nextIncomeDate === null
      ? null
      : daysUntil(input.today, input.nextIncomeDate);
  const perDay =
    daysLeft !== null && daysLeft > 0
      ? roundToRubles(divRound(remaining, daysLeft))
      : null;
  return {
    budget: input.budget,
    spent: input.spent,
    remaining,
    daysLeft,
    perDay,
  };
}

export type CategoryStatus =
  | { kind: "none" }
  | { kind: "ok"; left: number; share: number }
  | { kind: "over"; over: number; share: number };

/** Spending in a daily category against its optional limit. */
export function categoryStatus(
  limit: number | null,
  spent: number,
): CategoryStatus {
  if (limit === null) return { kind: "none" };
  if (spent > limit) return { kind: "over", over: spent - limit, share: 1 };
  const share = limit > 0 ? Math.max(spent, 0) / limit : 0;
  return { kind: "ok", left: limit - spent, share };
}
