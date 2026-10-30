import {
  ceiling,
  isFull,
  monthlyContribution,
  type CeilingSettings,
  type ContributionSettings,
} from "./envelope";

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
  /** Part of the surplus that found no non-full envelope. */
  toDaily: number;
}

/** Destination of one piece of a contribution: an envelope or daily spending. */
type Destination =
  | { envelopeId: string; amount: number; kind: AllocationKind }
  | { envelopeId: null; amount: number; kind: "surplus" };

/** One envelope's monthly contribution and where it goes. */
interface FundingItem {
  sourceEnvelopeId: string;
  amount: number;
  destinations: Destination[];
}

export interface WalletPlan {
  /** Funding items in priority order of their source envelopes. */
  items: FundingItem[];
  contributions: number;
  surplus: Omit<WalletSurplus, "walletId" | "walletName"> | null;
}

function byPriority(a: AllocationEnvelope, b: AllocationEnvelope): number {
  return a.priority - b.priority;
}

/**
 * Plans one wallet at full contributions.
 * Full envelopes (before allocation) give their contribution to the most
 * important non-full envelope; whatever would overflow a receiver's ceiling
 * moves to the next non-full one, and finally to daily spending.
 */
export function planWallet(envelopes: AllocationEnvelope[]): WalletPlan {
  const sorted = [...envelopes].sort(byPriority);
  const full = new Set(
    sorted.filter((e) => isFull(e, e.balance)).map((e) => e.id),
  );
  const receivers = sorted.filter((e) => !full.has(e.id));
  const projected = new Map(sorted.map((e) => [e.id, e.balance]));

  // Own contributions of non-full envelopes come first.
  const own = new Map<string, number>();
  for (const env of receivers) {
    const amount = monthlyContribution(env);
    own.set(env.id, amount);
    projected.set(env.id, env.balance + amount);
  }

  const items: FundingItem[] = [];
  const surplusByReceiver = new Map<string, number>();
  let surplusTotal = 0;
  let surplusToDaily = 0;
  const fullNames: string[] = [];

  for (const env of sorted) {
    const amount = monthlyContribution(env);
    if (amount <= 0) continue;

    if (!full.has(env.id)) {
      items.push({
        sourceEnvelopeId: env.id,
        amount,
        destinations: [{ envelopeId: env.id, amount, kind: "contribution" }],
      });
      continue;
    }

    fullNames.push(env.name);
    surplusTotal += amount;
    let left = amount;
    const destinations: Destination[] = [];
    for (const receiver of receivers) {
      if (left === 0) break;
      const room = ceiling(receiver) - projected.get(receiver.id)!;
      if (room <= 0) continue;
      const give = Math.min(left, room);
      destinations.push({
        envelopeId: receiver.id,
        amount: give,
        kind: "surplus",
      });
      projected.set(receiver.id, projected.get(receiver.id)! + give);
      surplusByReceiver.set(
        receiver.id,
        (surplusByReceiver.get(receiver.id) ?? 0) + give,
      );
      left -= give;
    }
    if (left > 0) {
      destinations.push({ envelopeId: null, amount: left, kind: "surplus" });
      surplusToDaily += left;
    }
    items.push({ sourceEnvelopeId: env.id, amount, destinations });
  }

  const contributions = items.reduce((s, i) => s + i.amount, 0);
  const surplus =
    surplusTotal > 0
      ? {
          amount: surplusTotal,
          fullEnvelopeNames: fullNames,
          receivers: receivers
            .filter((r) => surplusByReceiver.has(r.id))
            .map((r) => ({
              envelopeId: r.id,
              name: r.name,
              amount: surplusByReceiver.get(r.id)!,
            })),
          toDaily: surplusToDaily,
        }
      : null;

  return { items, contributions, surplus };
}

export interface AllocationPlan {
  income: number;
  /** Sum of all monthly contributions. */
  totalContributions: number;
  toEnvelopes: number;
  toDaily: number;
  /** How much is missing to cover all contributions; 0 if enough. */
  shortage: number;
  /** Amount per wallet, largest first. */
  wallets: { walletId: string; name: string; amount: number }[];
  lines: AllocationLine[];
  surpluses: WalletSurplus[];
}

/**
 * Plans how an income is split between envelopes and daily spending.
 * If the income is smaller than all contributions, contributions are funded
 * in wallet order and, inside a wallet, by envelope priority.
 */
export function planAllocation(
  wallets: AllocationWallet[],
  envelopes: AllocationEnvelope[],
  income: number,
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
  const enough = income >= totalContributions;

  const lines: AllocationLine[] = [];
  const walletAmounts = new Map<string, number>();
  let left = Math.max(income, 0);

  for (const { wallet, plan } of walletPlans) {
    for (const item of plan.items) {
      for (const dest of item.destinations) {
        if (dest.envelopeId === null) continue;
        const amount = enough ? dest.amount : Math.min(dest.amount, left);
        if (amount <= 0) continue;
        left -= amount;
        lines.push({
          envelopeId: dest.envelopeId,
          amount,
          kind: dest.kind,
          sourceEnvelopeId:
            dest.kind === "surplus" ? item.sourceEnvelopeId : null,
        });
        walletAmounts.set(
          wallet.id,
          (walletAmounts.get(wallet.id) ?? 0) + amount,
        );
      }
    }
  }

  const toEnvelopes = lines.reduce((s, l) => s + l.amount, 0);

  return {
    income,
    totalContributions,
    toEnvelopes,
    toDaily: income - toEnvelopes,
    shortage: enough ? 0 : totalContributions - income,
    wallets: walletPlans
      .map(({ wallet }) => ({
        walletId: wallet.id,
        name: wallet.name,
        amount: walletAmounts.get(wallet.id) ?? 0,
      }))
      .filter((w) => w.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    lines,
    surpluses: walletPlans.flatMap(({ wallet, plan }) =>
      plan.surplus
        ? [{ walletId: wallet.id, walletName: wallet.name, ...plan.surplus }]
        : [],
    ),
  };
}
