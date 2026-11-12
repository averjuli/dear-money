import {
  planAllocation,
  type AllocationEnvelope,
  type AllocationLine,
  type AllocationWallet,
} from "./allocation";

/**
 * An envelope as the replay sees it: its current settings, its start balance
 * and the moment it was created. `createdAt` and every `at` below are numbers
 * on one time axis (milliseconds); only their order matters.
 */
export type ReplayEnvelope = Omit<AllocationEnvelope, "balance"> & {
  startBalance: number;
  createdAt: number;
};

/** Something that changed an envelope balance, with a sign: + in, − out. */
export interface BalanceEvent {
  envelopeId: string;
  amount: number;
  /** When it was entered. */
  at: number;
}

/** An income to lay out again. */
export interface ReplayIncome {
  id: string;
  /** When it was entered. */
  at: number;
  amount: number;
  /** Wallets unchecked when it was allocated; empty means all were checked. */
  skippedWalletIds: string[];
  /** The part that went to envelopes deleted since; it stays as it was. */
  toDeleted: number;
}

export interface ReplayedIncome {
  id: string;
  /** Including `toDeleted`. */
  toEnvelopes: number;
  toDaily: number;
  lines: AllocationLine[];
}

/**
 * The part of an income that went into envelopes which no longer exist: what
 * the income says went to envelopes minus what is still in its lines.
 * Never negative.
 */
export function deletedEnvelopesShare(
  toEnvelopes: number,
  liveLinesTotal: number,
): number {
  return Math.max(0, toEnvelopes - liveLinesTotal);
}

/**
 * The envelopes that existed at a moment with their balances then: the start
 * balance plus every event entered before the moment. An envelope created at
 * or after the moment is not there yet.
 */
export function envelopesAt(
  envelopes: ReplayEnvelope[],
  events: BalanceEvent[],
  at: number,
): AllocationEnvelope[] {
  return envelopes
    .filter((e) => e.createdAt < at)
    .map((e) => ({
      id: e.id,
      walletId: e.walletId,
      name: e.name,
      priority: e.priority,
      costPerTime: e.costPerTime,
      periodN: e.periodN,
      periodUnit: e.periodUnit,
      contributionOverride: e.contributionOverride,
      timesToSave: e.timesToSave,
      balance:
        e.startBalance +
        events
          .filter((ev) => ev.envelopeId === e.id && ev.at < at)
          .reduce((sum, ev) => sum + ev.amount, 0),
    }));
}

/**
 * Lays out the given incomes again, in the order given, one after another:
 * each from the balances at its own moment (everything entered before it with
 * the current sums, including the lines this replay just made for earlier
 * incomes), with the current settings of the envelopes that already existed
 * and the checkboxes the income remembers. The money that went to deleted
 * envelopes is set aside first and added back to «в конверты».
 *
 * `events` are everything else that moved envelope balances: expenses,
 * transfers and the lines of earlier incomes that are not laid out again.
 */
export function replayIncomes(input: {
  wallets: AllocationWallet[];
  envelopes: ReplayEnvelope[];
  events: BalanceEvent[];
  incomes: ReplayIncome[];
}): ReplayedIncome[] {
  const events = [...input.events];
  const result: ReplayedIncome[] = [];
  for (const income of input.incomes) {
    const plan = planAllocation(
      input.wallets,
      envelopesAt(input.envelopes, events, income.at),
      Math.max(income.amount - income.toDeleted, 0),
      income.skippedWalletIds,
    );
    result.push({
      id: income.id,
      toEnvelopes: income.toDeleted + plan.toEnvelopes,
      toDaily: plan.toDaily,
      lines: plan.lines,
    });
    // Seen by every later income, even one entered at the very same moment.
    for (const line of plan.lines) {
      events.push({
        envelopeId: line.envelopeId,
        amount: line.amount,
        at: Number.NEGATIVE_INFINITY,
      });
    }
  }
  return result;
}

export interface BreakdownEnvelope {
  envelopeId: string;
  name: string;
  amount: number;
  /** The envelope's own contribution inside `amount`. */
  contribution: number;
  /** Contributions of full envelopes of the wallet that came here. */
  surplus: number;
}

export interface BreakdownWallet {
  walletId: string;
  name: string;
  amount: number;
  envelopes: BreakdownEnvelope[];
}

export interface IncomeBreakdown {
  /** Wallets in their order; those that got nothing are left out. */
  wallets: BreakdownWallet[];
  /** The part that went to envelopes which no longer exist. */
  toDeleted: number;
}

/**
 * A saved income for the income screen: wallets in their order, in each the
 * envelopes that got money by priority, split into the contribution and the
 * surplus. A line of an envelope that is no longer there is not shown; its
 * money is the `toDeleted` remainder.
 */
export function incomeBreakdown(
  lines: Pick<AllocationLine, "envelopeId" | "amount" | "kind">[],
  wallets: AllocationWallet[],
  envelopes: { id: string; walletId: string; name: string; priority: number }[],
  toEnvelopes: number,
): IncomeBreakdown {
  const known = new Map(envelopes.map((e) => [e.id, e]));
  const own = lines.filter((l) => known.has(l.envelopeId));
  const result: BreakdownWallet[] = [];

  for (const wallet of [...wallets].sort((a, b) => a.order - b.order)) {
    const inWallet = envelopes
      .filter((e) => e.walletId === wallet.id)
      .sort((a, b) => a.priority - b.priority);
    const rows: BreakdownEnvelope[] = [];
    for (const envelope of inWallet) {
      const mine = own.filter((l) => l.envelopeId === envelope.id);
      const sum = (kind: AllocationLine["kind"]) =>
        mine.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount, 0);
      const amount = mine.reduce((s, l) => s + l.amount, 0);
      if (amount === 0) continue;
      rows.push({
        envelopeId: envelope.id,
        name: envelope.name,
        amount,
        contribution: sum("contribution"),
        surplus: sum("surplus"),
      });
    }
    const amount = rows.reduce((s, r) => s + r.amount, 0);
    if (amount === 0) continue;
    result.push({
      walletId: wallet.id,
      name: wallet.name,
      amount,
      envelopes: rows,
    });
  }

  const liveTotal = own.reduce((s, l) => s + l.amount, 0);
  return {
    wallets: result,
    toDeleted: deletedEnvelopesShare(toEnvelopes, liveTotal),
  };
}

/**
 * What deleting an income takes away: from the envelopes, what its lines put
 * in them (money that went to deleted envelopes is already gone), and from
 * «на жизнь», its daily share.
 */
export function incomeDeletionEffect(
  income: { toDaily: number },
  lines: Pick<AllocationLine, "amount">[],
): { fromEnvelopes: number; fromDaily: number } {
  return {
    fromEnvelopes: lines.reduce((s, l) => s + l.amount, 0),
    fromDaily: income.toDaily,
  };
}
