import { timesCovered } from "./envelope";

export interface ExpenseHint {
  newBalance: number;
  times: number;
  negative: boolean;
}

/** What happens to an envelope if the expense is saved. */
export function expenseHint(
  env: { balance: number; costPerTime: number },
  amount: number,
): ExpenseHint {
  const newBalance = env.balance - amount;
  return {
    newBalance,
    times: timesCovered(env, newBalance),
    negative: newBalance < 0,
  };
}

export const RECENT_LIMIT = 6;

/**
 * Up to six recently used targets, newest first, without repeats.
 * Topped up from the fallback list (first envelopes in wallet order).
 */
export function recentTargets(
  usedNewestFirst: string[],
  fallback: string[],
): string[] {
  const result: string[] = [];
  for (const id of [...usedNewestFirst, ...fallback]) {
    if (result.length === RECENT_LIMIT) break;
    if (!result.includes(id)) result.push(id);
  }
  return result;
}
