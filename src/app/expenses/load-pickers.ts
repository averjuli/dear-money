import { recentTargets } from "@/domain/expense";
import {
  loadCategories,
  loadRecentTargetIds,
  loadWallets,
} from "@/server/queries";
import type { PickCategory, PickWallet } from "./expense-form";

/** Everything the expense form needs to pick an envelope or a category. */
export async function loadPickers(userId: string, since: string) {
  const [walletViews, categories, recent] = await Promise.all([
    loadWallets(userId),
    loadCategories(userId, since),
    loadRecentTargetIds(userId),
  ]);
  const wallets: PickWallet[] = walletViews
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
  const pickCategories: PickCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  return {
    wallets,
    categories: pickCategories,
    recentEnvelopeIds: recentTargets(
      recent.envelopes,
      wallets.flatMap((w) => w.envelopes.map((e) => e.id)),
    ),
    recentCategoryIds: recentTargets(recent.categories, []),
  };
}

/** Only internal paths are allowed as the screen to return to. */
export function safeBackHref(from: string | string[] | undefined): string {
  const value = Array.isArray(from) ? from[0] : from;
  return value && /^\/[a-z0-9/-]*$/i.test(value) && !value.startsWith("//")
    ? value
    : "/";
}
