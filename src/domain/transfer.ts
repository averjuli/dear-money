import { timesCovered } from "./envelope";

/**
 * One side of a transfer: «на жизнь», an envelope, or an envelope that was
 * deleted after the transfer was saved (only a saved transfer can have it).
 */
export type TransferSide =
  | { kind: "daily" }
  | { kind: "envelope"; envelopeId: string }
  | { kind: "deleted" };

/** A transfer as it is stored: amount in kopecks and both sides. */
export interface SavedTransfer {
  amount: number;
  from: TransferSide;
  to: TransferSide;
}

function sameSide(a: TransferSide, b: TransferSide): boolean {
  if (a.kind === "daily") return b.kind === "daily";
  if (a.kind === "envelope") {
    return b.kind === "envelope" && b.envelopeId === a.envelopeId;
  }
  // Two deleted envelopes cannot be told apart, and one is never a match.
  return false;
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Whether the transfer may be saved. One function for the button and for
 * the server check. `initial` is the saved transfer when editing.
 */
export function canTransfer(input: {
  amount: number;
  from: TransferSide | null;
  to: TransferSide | null;
  date: string;
  today: string;
  dailyAvailable: boolean;
  initial: SavedTransfer | null;
}): boolean {
  const { from, to, initial } = input;
  if (!Number.isFinite(input.amount) || input.amount <= 0) return false;
  if (from === null || to === null) return false;
  if (!isDay(input.date) || input.date > input.today) return false;
  if (sameSide(from, to)) return false;
  if (!input.dailyAvailable && (from.kind === "daily" || to.kind === "daily")) {
    return false;
  }
  // A deleted envelope can only stay on the side where it already was.
  if (from.kind === "deleted" && initial?.from.kind !== "deleted") return false;
  if (to.kind === "deleted" && initial?.to.kind !== "deleted") return false;
  return true;
}

/**
 * What the transfer does to one side: − if money left it, + if money came,
 * 0 if the side is not in the transfer.
 */
export function signedAmount(
  transfer: SavedTransfer,
  viewpoint: TransferSide,
): number {
  if (sameSide(transfer.from, viewpoint)) return -transfer.amount;
  if (sameSide(transfer.to, viewpoint)) return transfer.amount;
  return 0;
}

/** A balance as if the saved transfer had never been made (for editing). */
export function withoutTransfer(
  balance: number,
  viewpoint: TransferSide,
  initial: SavedTransfer | null,
): number {
  return initial === null
    ? balance
    : balance - signedAmount(initial, viewpoint);
}

/** How a saved transfer changes «на жизнь» (a deleted transfer: null). */
export function transferDailyEffect(transfer: SavedTransfer | null): number {
  return transfer === null ? 0 : signedAmount(transfer, { kind: "daily" });
}

export type SideHint =
  | {
      kind: "envelope";
      envelopeId: string;
      newBalance: number;
      times: number;
      negative: boolean;
    }
  | { kind: "daily"; remaining: number; negative: boolean };

export interface TransferHint {
  from: SideHint | null;
  to: SideHint | null;
}

/**
 * What becomes of both sides if the transfer is saved. Stored balances
 * include the saved transfer, so when editing it is taken out first.
 * A deleted or unchosen side has no hint.
 */
export function transferHint(input: {
  amount: number;
  from: TransferSide | null;
  to: TransferSide | null;
  initial: SavedTransfer | null;
  lookup: (
    envelopeId: string,
  ) => { balance: number; costPerTime: number } | undefined;
  /** What is left for daily life now; null before the first allocation. */
  dailyRemaining: number | null;
  /** Everything this transfer already added to «на жизнь» (0 for a new one). */
  journaledDaily: number;
}): TransferHint {
  const draft: SavedTransfer | null =
    input.from !== null && input.to !== null
      ? { amount: input.amount, from: input.from, to: input.to }
      : null;

  function side(side: TransferSide | null): SideHint | null {
    if (side === null || side.kind === "deleted") return null;
    if (side.kind === "daily") {
      if (input.dailyRemaining === null) return null;
      const effect = draft === null ? 0 : signedAmount(draft, side);
      const remaining = input.dailyRemaining + effect - input.journaledDaily;
      return { kind: "daily", remaining, negative: remaining < 0 };
    }
    const env = input.lookup(side.envelopeId);
    if (!env) return null;
    const base = withoutTransfer(env.balance, side, input.initial);
    const newBalance = base + (draft === null ? 0 : signedAmount(draft, side));
    return {
      kind: "envelope",
      envelopeId: side.envelopeId,
      newBalance,
      times: timesCovered(env, newBalance),
      negative: newBalance < 0,
    };
  }

  return { from: side(input.from), to: side(input.to) };
}
