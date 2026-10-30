import demoSeed from "../../data/demo-seed.json";
import sampleSeed from "../../data/sample-seed.json";
import type { AllocationEnvelope, AllocationWallet } from "./allocation";
import type { PeriodUnit } from "./envelope";

/** Rubles to kopecks for readable test numbers. */
export const rub = (value: number): number => Math.round(value * 100);

interface SeedFile {
  wallets: { id: string; name: string; order: number }[];
  envelopes: {
    id: string;
    walletId: string;
    name: string;
    priority: number;
    costPerTime: number;
    periodN: number;
    periodUnit: string;
    contributionOverride: number | null;
    timesToSave: number;
    startBalance: number;
  }[];
}

function seedWallets(seed: SeedFile): AllocationWallet[] {
  return seed.wallets.map((w) => ({ id: w.id, name: w.name, order: w.order }));
}

function seedEnvelopes(seed: SeedFile): AllocationEnvelope[] {
  return seed.envelopes.map((e) => ({
    id: e.id,
    walletId: e.walletId,
    name: e.name,
    priority: e.priority,
    costPerTime: e.costPerTime,
    periodN: e.periodN,
    periodUnit: e.periodUnit as PeriodUnit,
    contributionOverride: e.contributionOverride,
    timesToSave: e.timesToSave,
    balance: e.startBalance,
  }));
}

export const demoWallets = () => seedWallets(demoSeed);
export const demoEnvelopes = () => seedEnvelopes(demoSeed);
export const sampleWallets = () => seedWallets(sampleSeed);
export const sampleEnvelopes = () => seedEnvelopes(sampleSeed);

export function demoEnvelope(name: string): AllocationEnvelope {
  const found = demoEnvelopes().find((e) => e.name === name);
  if (!found) throw new Error(`Demo envelope not found: ${name}`);
  return found;
}
