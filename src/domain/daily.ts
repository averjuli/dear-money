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

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * The nearest day after today that has one of the given days of the month
 * (the advance and the salary day; an empty one is skipped). A day the month
 * does not have (31 in November) is the last day of that month. A day equal
 * to today does not count: today's money is already in the balance.
 */
export function nextPayDate(
  today: string,
  days: (number | null)[],
): string | null {
  const [year, month, todayDay] = today.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const dates: string[] = [];
  for (const day of days) {
    if (day === null) continue;
    const inThisMonth = Math.min(day, daysInMonth(year, month));
    if (inThisMonth > todayDay) {
      dates.push(isoDate(year, month, inThisMonth));
    } else {
      const inNextMonth = Math.min(day, daysInMonth(nextYear, nextMonth));
      dates.push(isoDate(nextYear, nextMonth, inNextMonth));
    }
  }
  // ISO dates sort the same as calendar dates.
  return dates.sort()[0] ?? null;
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

/**
 * How a saved expense changes «на жизнь»: a daily expense (no envelope)
 * takes its amount, an envelope expense or a deleted one changes nothing.
 */
export function expenseDailyEffect(
  expense: { amount: number; envelopeId: string | null } | null,
): number {
  if (expense === null || expense.envelopeId !== null) return 0;
  return -expense.amount;
}

/**
 * The amount of a new journal row: what the item does to «на жизнь» now
 * minus what its earlier rows already added. Zero means no row.
 */
export function dailyMove(input: {
  effect: number;
  journaled: number;
}): number {
  return input.effect - input.journaled;
}

/**
 * The journal amount to write for a saved or deleted item. With an income it
 * is `dailyMove`. With no incomes nothing is added for an item the journal
 * has not seen yet (it is counted whole when the next income is allocated),
 * but an item with rows keeps being tracked, so what it did stays in the sum.
 */
export function dailyMoveToRecord(input: {
  effect: number;
  journaled: number;
  hasIncome: boolean;
}): number {
  if (!input.hasIncome && input.journaled === 0) return 0;
  return dailyMove(input);
}

/**
 * «Осталось на жизнь»: the shares of all incomes meant for daily life plus
 * every journal row (transfers and daily expenses, whatever their date).
 * Leftovers and overspending carry over from one income to the next.
 */
export function dailyRemaining(input: {
  toDaily: number[];
  moves: number[];
}): number {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  return sum(input.toDaily) + sum(input.moves);
}

export interface DailySummary {
  remaining: number;
  /** The nearest day with the advance or the salary; null when none is set. */
  nextPayDate: string | null;
  /** Rounded to whole rubles, negative when overspent; null without a date. */
  perDay: number | null;
}

export function dailySummary(input: {
  remaining: number;
  today: string;
  /** Advance and salary days of the month; empty ones are null. */
  payDays: (number | null)[];
}): DailySummary {
  const next = nextPayDate(input.today, input.payDays);
  const perDay =
    next === null
      ? null
      : roundToRubles(divRound(input.remaining, daysUntil(input.today, next)));
  return { remaining: input.remaining, nextPayDate: next, perDay };
}

/**
 * What is left for daily life if a daily expense is saved. `journaled` is
 * what the expense has already added to «на жизнь» (0 for a new one).
 */
export function remainingAfterExpense(input: {
  remaining: number;
  amount: number;
  journaled: number;
}): number {
  return (
    input.remaining +
    dailyMove({
      effect: expenseDailyEffect({ amount: input.amount, envelopeId: null }),
      journaled: input.journaled,
    })
  );
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
