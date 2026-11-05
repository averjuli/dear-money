import {
  isFull,
  monthlyContribution,
  type CeilingSettings,
  type ContributionSettings,
} from "./envelope";
import { half } from "./money";

export interface AllocationWallet {
  id: string;
  name: string;
  order: number;
}

export interface AllocationEnvelope
  extends ContributionSettings, CeilingSettings {
  id: string;
  walletId: string;
  name: string;
  priority: number;
  /** Balance right before this allocation. */
  balance: number;
}

export type AllocationKind = "contribution" | "surplus";

export interface AllocationLine {
  envelopeId: string;
  amount: number;
  kind: AllocationKind;
  /** For surplus: the full envelope whose contribution moved here. */
  sourceEnvelopeId: string | null;
}

export interface SurplusReceiver {
  envelopeId: string;
  name: string;
  amount: number;
}

export interface WalletSurplus {
  walletId: string;
  walletName: string;
  amount: number;
  fullEnvelopeNames: string[];
  receivers: SurplusReceiver[];
  /** Every envelope of the wallet is full: each keeps its own contribution. */
  allFull: boolean;
}

/** One envelope's contribution from one income and where it goes. */
interface FundingItem {
  sourceEnvelopeId: string;
  amount: number;
  destinationEnvelopeId: string;
  kind: AllocationKind;
}

export interface WalletPlan {
  /** Funding items in priority order of their source envelopes. */
  items: FundingItem[];
  contributions: number;
  surplus: Omit<WalletSurplus, "walletId" | "walletName"> | null;
}

/** What one income puts into an envelope: half of the monthly contribution. */
export function incomeContribution(env: ContributionSettings): number {
  return half(monthlyContribution(env));
}

function byPriority(a: AllocationEnvelope, b: AllocationEnvelope): number {
  return a.priority - b.priority;
}

/**
 * Plans one wallet at full contributions.
 * A full envelope (before allocation) gives its contribution, whole, to the
 * most important non-full envelope; that envelope may end up above its
 * ceiling. If every envelope is full, each keeps its own contribution.
 */
export function planWallet(envelopes: AllocationEnvelope[]): WalletPlan {
  const sorted = [...envelopes].sort(byPriority);
  const full = new Set(
    sorted.filter((e) => isFull(e, e.balance)).map((e) => e.id),
  );
  const receiver = sorted.find((e) => !full.has(e.id)) ?? null;

  const items: FundingItem[] = [];
  const fullNames: string[] = [];
  let surplusTotal = 0;
  let surplusToReceiver = 0;

  for (const env of sorted) {
    const amount = incomeContribution(env);
    if (amount <= 0) continue;

    if (!full.has(env.id) || receiver === null) {
      if (full.has(env.id)) {
        fullNames.push(env.name);
        surplusTotal += amount;
      }
      items.push({
        sourceEnvelopeId: env.id,
        amount,
        destinationEnvelopeId: env.id,
        kind: "contribution",
      });
      continue;
    }

    fullNames.push(env.name);
    surplusTotal += amount;
    surplusToReceiver += amount;
    items.push({
      sourceEnvelopeId: env.id,
      amount,
      destinationEnvelopeId: receiver.id,
      kind: "surplus",
    });
  }

  const contributions = items.reduce((s, i) => s + i.amount, 0);
  const surplus =
    surplusTotal > 0
      ? {
          amount: surplusTotal,
          fullEnvelopeNames: fullNames,
          receivers:
            receiver !== null && surplusToReceiver > 0
              ? [
                  {
                    envelopeId: receiver.id,
                    name: receiver.name,
                    amount: surplusToReceiver,
                  },
                ]
              : [],
          allFull: receiver === null,
        }
      : null;

  return { items, contributions, surplus };
}

export interface WalletAmount {
  walletId: string;
  name: string;
  amount: number;
}

export interface AllocationPlan {
  income: number;
  /** Sum of the contributions of all wallets from one income. */
  totalContributions: number;
  toEnvelopes: number;
  toDaily: number;
  /** How much is missing to cover the contributions of checked wallets. */
  shortage: number;
  /** Income is smaller than all contributions: wallets can be unchecked. */
  needsChoice: boolean;
  /** No wallet is unchecked. */
  allSelected: boolean;
  /** Amount per wallet that got money, largest first. */
  wallets: WalletAmount[];
  /** Amount per wallet in wallet order, zeros included. */
  byWallet: WalletAmount[];
  lines: AllocationLine[];
  surpluses: WalletSurplus[];
}

/**
 * Plans how an income is split between envelopes and daily spending.
 * If the income is smaller than all contributions, only checked wallets get
 * money: in wallet order and, inside a wallet, by envelope priority.
 * Unchecked wallets are ignored when the income covers everything.
 */
export function planAllocation(
  wallets: AllocationWallet[],
  envelopes: AllocationEnvelope[],
  income: number,
  skippedWalletIds: string[] = [],
): AllocationPlan {
  const orderedWallets = [...wallets].sort((a, b) => a.order - b.order);
  const walletPlans = orderedWallets.map((wallet) => ({
    wallet,
    plan: planWallet(envelopes.filter((e) => e.walletId === wallet.id)),
  }));

  const totalContributions = walletPlans.reduce(
    (s, w) => s + w.plan.contributions,
    0,
  );
  const needsChoice = income < totalContributions;
  const skipped = new Set(needsChoice ? skippedWalletIds : []);
  const selected = walletPlans.filter(({ wallet }) => !skipped.has(wallet.id));
  const selectedTotal = selected.reduce((s, w) => s + w.plan.contributions, 0);
  const enough = income >= selectedTotal;

  const lines: AllocationLine[] = [];
  const walletAmounts = new Map<string, number>();
  let left = Math.max(income, 0);

  for (const { wallet, plan } of selected) {
    for (const item of plan.items) {
      const amount = enough ? item.amount : Math.min(item.amount, left);
      if (amount <= 0) continue;
      left -= amount;
      lines.push({
        envelopeId: item.destinationEnvelopeId,
        amount,
        kind: item.kind,
        sourceEnvelopeId:
          item.kind === "surplus" ? item.sourceEnvelopeId : null,
      });
      walletAmounts.set(
        wallet.id,
        (walletAmounts.get(wallet.id) ?? 0) + amount,
      );
    }
  }

  const toEnvelopes = lines.reduce((s, l) => s + l.amount, 0);
  const byWallet = walletPlans.map(({ wallet }) => ({
    walletId: wallet.id,
    name: wallet.name,
    amount: walletAmounts.get(wallet.id) ?? 0,
  }));

  return {
    income,
    totalContributions,
    toEnvelopes,
    toDaily: income - toEnvelopes,
    shortage: enough ? 0 : selectedTotal - income,
    needsChoice,
    allSelected: selected.length === walletPlans.length,
    wallets: byWallet
      .filter((w) => w.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    byWallet,
    lines,
    surpluses: selected.flatMap(({ wallet, plan }) =>
      plan.surplus
        ? [{ walletId: wallet.id, walletName: wallet.name, ...plan.surplus }]
        : [],
    ),
  };
}
