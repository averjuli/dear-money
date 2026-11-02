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

/** First day of the calendar month of the given date, "YYYY-MM-01". */
export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/** True when the date falls in the same calendar month as today. */
export function isInMonth(date: string, today: string): boolean {
  return date.slice(0, 7) === today.slice(0, 7);
}

/**
 * Everything spent in the current calendar month under a category: daily
 * expenses and envelope expenses with a category. An envelope expense
 * without a category (entered before categories existed) is not included.
 */
export function monthSpending(
  expenses: { amount: number; date: string; categoryId: string | null }[],
  today: string,
): number {
  return expenses
    .filter((e) => e.categoryId !== null && isInMonth(e.date, today))
    .reduce((sum, e) => sum + e.amount, 0);
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

/** What is left for daily life if a daily expense is saved. */
export function remainingAfterExpense(
  remaining: number,
  amount: number,
): number {
  return remaining - amount;
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
