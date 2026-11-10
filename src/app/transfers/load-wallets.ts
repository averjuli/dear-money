import { loadWallets } from "@/server/queries";
import type { PickWallet } from "../expenses/expense-form";

/** Wallets with envelopes and balances for the pickers of the transfer form. */
export async function loadTransferWallets(
  userId: string,
): Promise<PickWallet[]> {
  const walletViews = await loadWallets(userId);
  return walletViews
    .filter((w) => w.envelopes.length > 0)
    .map((w) => ({
      id: w.id,
      name: w.name,
      envelopes: w.envelopes.map((e) => ({
        id: e.id,
        name: e.name,
        balance: e.balance,
        costPerTime: e.costPerTime,
      })),
    }));
}
