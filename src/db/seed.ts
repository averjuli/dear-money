import { and, eq, isNotNull } from "drizzle-orm";
import { PERIOD_UNITS, type PeriodUnit } from "@/domain/envelope";
import type { Db } from "./client";
import { envelopes, spendCategories, users, wallets } from "./schema";

export interface SeedData {
  wallets: { id: string; name: string; order: number }[];
  envelopes: {
    id: string;
    walletId: string;
    name: string;
    priority: number;
    costPerTime: number;
    periodN: number;
    periodUnit: PeriodUnit;
    contributionOverride: number | null;
    timesToSave: number;
    startBalance: number;
  }[];
  spendCategories: { id: string; name: string; monthlyLimit?: number | null }[];
  expenses?: unknown[];
  incomes?: unknown[];
}

function fail(message: string): never {
  throw new Error(`Invalid seed file: ${message}`);
}

const isInt = (v: unknown): v is number => Number.isSafeInteger(v);
const isText = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

/** Checks the JSON shape of data/demo-seed.json without trusting it. */
export function parseSeed(raw: unknown): SeedData {
  if (typeof raw !== "object" || raw === null) fail("not an object");
  const data = raw as Record<string, unknown>;
  const list = (key: string): Record<string, unknown>[] => {
    const value = data[key] ?? [];
    if (!Array.isArray(value)) fail(`${key} must be an array`);
    return value as Record<string, unknown>[];
  };

  const seedWallets = list("wallets").map((w, i) => {
    if (!isText(w.id) || !isText(w.name) || !isInt(w.order))
      fail(`wallets[${i}] needs id, name and integer order`);
    return { id: w.id, name: w.name, order: w.order };
  });
  const walletIds = new Set(seedWallets.map((w) => w.id));

  const seedEnvelopes = list("envelopes").map((e, i) => {
    const where = `envelopes[${i}]`;
    if (!isText(e.id) || !isText(e.name)) fail(`${where} needs id and name`);
    if (!isText(e.walletId) || !walletIds.has(e.walletId))
      fail(`${where} has unknown walletId`);
    for (const key of [
      "priority",
      "costPerTime",
      "periodN",
      "timesToSave",
      "startBalance",
    ]) {
      if (!isInt(e[key])) fail(`${where}.${key} must be an integer (kopecks)`);
    }
    if (!PERIOD_UNITS.includes(e.periodUnit as PeriodUnit))
      fail(`${where}.periodUnit must be week, month or year`);
    if (e.contributionOverride != null && !isInt(e.contributionOverride))
      fail(`${where}.contributionOverride must be an integer or null`);
    if ((e.periodN as number) < 1 || (e.timesToSave as number) < 1)
      fail(`${where}: periodN and timesToSave must be at least 1`);
    return {
      id: e.id,
      walletId: e.walletId,
      name: e.name,
      priority: e.priority as number,
      costPerTime: e.costPerTime as number,
      periodN: e.periodN as number,
      periodUnit: e.periodUnit as PeriodUnit,
      contributionOverride: (e.contributionOverride as number | null) ?? null,
      timesToSave: e.timesToSave as number,
      startBalance: e.startBalance as number,
    };
  });

  const seedCategories = list("spendCategories").map((c, i) => {
    if (!isText(c.id) || !isText(c.name))
      fail(`spendCategories[${i}] needs id and name`);
    if (c.monthlyLimit != null && !isInt(c.monthlyLimit))
      fail(`spendCategories[${i}].monthlyLimit must be an integer or absent`);
    return {
      id: c.id,
      name: c.name,
      monthlyLimit: (c.monthlyLimit as number | null) ?? null,
    };
  });

  return {
    wallets: seedWallets,
    envelopes: seedEnvelopes,
    spendCategories: seedCategories,
    expenses: list("expenses"),
    incomes: list("incomes"),
  };
}

export interface SeedResult {
  wallets: number;
  envelopes: number;
  spendCategories: number;
}

/**
 * Loads wallets, envelopes and daily categories for one user.
 * Rows are matched by the seed id, so loading the same file again
 * adds nothing and never overwrites changes made in the app.
 */
export async function seedUserData(
  db: Db,
  login: string,
  data: SeedData,
): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    await tx.insert(users).values({ login }).onConflictDoNothing();
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.login, login));

    const insertedWallets = await tx
      .insert(wallets)
      .values(
        data.wallets.map((w) => ({
          userId: user.id,
          name: w.name,
          position: w.order,
          seedKey: w.id,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: wallets.id });

    const walletRows = await tx
      .select({ id: wallets.id, seedKey: wallets.seedKey })
      .from(wallets)
      .where(and(eq(wallets.userId, user.id), isNotNull(wallets.seedKey)));
    const walletBySeed = new Map(walletRows.map((w) => [w.seedKey, w.id]));

    const insertedEnvelopes = data.envelopes.length
      ? await tx
          .insert(envelopes)
          .values(
            data.envelopes.map((e) => ({
              userId: user.id,
              walletId: walletBySeed.get(e.walletId)!,
              name: e.name,
              priority: e.priority,
              costPerTime: e.costPerTime,
              periodN: e.periodN,
              periodUnit: e.periodUnit,
              contributionOverride: e.contributionOverride,
              timesToSave: e.timesToSave,
              startBalance: e.startBalance,
              seedKey: e.id,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: envelopes.id })
      : [];

    const insertedCategories = data.spendCategories.length
      ? await tx
          .insert(spendCategories)
          .values(
            data.spendCategories.map((c, i) => ({
              userId: user.id,
              name: c.name,
              monthlyLimit: c.monthlyLimit ?? null,
              position: i + 1,
              seedKey: c.id,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: spendCategories.id })
      : [];

    return {
      wallets: insertedWallets.length,
      envelopes: insertedEnvelopes.length,
      spendCategories: insertedCategories.length,
    };
  });
}
