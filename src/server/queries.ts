import { and, asc, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  allocations,
  envelopes,
  expenses,
  incomes,
  spendCategories,
  wallets,
} from "@/db/schema";
import type { AllocationEnvelope, AllocationWallet } from "@/domain/allocation";
import {
  ceiling,
  envelopeBalance,
  envelopeStatus,
  monthlyContribution,
  timesCovered,
  type EnvelopeStatus,
  type PeriodUnit,
} from "@/domain/envelope";
import { monthStartIso } from "./today";

export interface EnvelopeView {
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
  balance: number;
  contribution: number;
  ceiling: number;
  status: EnvelopeStatus;
  times: number;
  expenseCount: number;
}

export interface WalletView {
  id: string;
  name: string;
  position: number;
  envelopes: EnvelopeView[];
  total: number;
  contributions: number;
  minusCount: number;
}

export interface CategoryView {
  id: string;
  name: string;
  monthlyLimit: number | null;
  position: number;
  spent: number;
}

export interface IncomeView {
  id: string;
  date: string;
  amount: number;
  kind: "salary" | "advance" | "other";
  nextIncomeDate: string | null;
  toDaily: number;
}

export interface ExpenseView {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  envelopeId: string | null;
  categoryId: string | null;
  /** Envelope name, or the category name for a daily expense. */
  targetName: string;
  categoryName: string | null;
  envelopeName: string | null;
}

/** Wallets with envelopes and their current balances. */
export async function loadWallets(userId: string): Promise<WalletView[]> {
  const db = getDb();
  const [walletRows, envelopeRows, allocated, spent] = await Promise.all([
    db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .orderBy(asc(wallets.position), asc(wallets.createdAt)),
    db
      .select()
      .from(envelopes)
      .where(eq(envelopes.userId, userId))
      .orderBy(asc(envelopes.priority), asc(envelopes.createdAt)),
    db
      .select({
        envelopeId: allocations.envelopeId,
        total: sql<number>`coalesce(sum(${allocations.amount}), 0)::int`,
      })
      .from(allocations)
      .where(eq(allocations.userId, userId))
      .groupBy(allocations.envelopeId),
    db
      .select({
        envelopeId: expenses.envelopeId,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), isNotNull(expenses.envelopeId)))
      .groupBy(expenses.envelopeId),
  ]);

  const allocatedBy = new Map(allocated.map((a) => [a.envelopeId, a.total]));
  const spentBy = new Map(spent.map((s) => [s.envelopeId, s]));

  const views: EnvelopeView[] = envelopeRows.map((e) => {
    const balance = envelopeBalance({
      startBalance: e.startBalance,
      allocated: allocatedBy.get(e.id) ?? 0,
      spent: spentBy.get(e.id)?.total ?? 0,
    });
    return {
      id: e.id,
      walletId: e.walletId,
      name: e.name,
      priority: e.priority,
      costPerTime: e.costPerTime,
      periodN: e.periodN,
      periodUnit: e.periodUnit,
      contributionOverride: e.contributionOverride,
      timesToSave: e.timesToSave,
      startBalance: e.startBalance,
      balance,
      contribution: monthlyContribution(e),
      ceiling: ceiling(e),
      status: envelopeStatus(e, balance),
      times: timesCovered(e, balance),
      expenseCount: spentBy.get(e.id)?.count ?? 0,
    };
  });

  return walletRows.map((w) => {
    const own = views.filter((e) => e.walletId === w.id);
    return {
      id: w.id,
      name: w.name,
      position: w.position,
      envelopes: own,
      total: own.reduce((s, e) => s + e.balance, 0),
      contributions: own.reduce((s, e) => s + e.contribution, 0),
      minusCount: own.filter((e) => e.status === "minus").length,
    };
  });
}

/** Domain input for allocation planning. */
export function toAllocationInput(walletViews: WalletView[]): {
  wallets: AllocationWallet[];
  envelopes: AllocationEnvelope[];
} {
  return {
    wallets: walletViews.map((w) => ({
      id: w.id,
      name: w.name,
      order: w.position,
    })),
    envelopes: walletViews.flatMap((w) =>
      w.envelopes.map((e) => ({
        id: e.id,
        walletId: e.walletId,
        name: e.name,
        priority: e.priority,
        costPerTime: e.costPerTime,
        periodN: e.periodN,
        periodUnit: e.periodUnit,
        contributionOverride: e.contributionOverride,
        timesToSave: e.timesToSave,
        balance: e.balance,
      })),
    ),
  };
}

export async function loadLatestIncome(
  userId: string,
): Promise<IncomeView | null> {
  const [row] = await getDb()
    .select()
    .from(incomes)
    .where(eq(incomes.userId, userId))
    .orderBy(desc(incomes.date), desc(incomes.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    kind: row.kind,
    nextIncomeDate: row.nextIncomeDate,
    toDaily: row.toDaily,
  };
}

/** Start of the current daily period: last allocated income or month start. */
export function periodStart(income: IncomeView | null): string {
  return income?.date ?? monthStartIso();
}

/**
 * Visible categories with everything spent in them since the given day:
 * daily expenses and envelope expenses. Deleted categories are left out.
 */
export async function loadCategories(
  userId: string,
  since: string,
): Promise<CategoryView[]> {
  const db = getDb();
  const [rows, spent] = await Promise.all([
    db
      .select()
      .from(spendCategories)
      .where(
        and(
          eq(spendCategories.userId, userId),
          isNull(spendCategories.deletedAt),
        ),
      )
      .orderBy(asc(spendCategories.position), asc(spendCategories.createdAt)),
    db
      .select({
        categoryId: expenses.categoryId,
        total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          isNotNull(expenses.categoryId),
          gte(expenses.date, since),
        ),
      )
      .groupBy(expenses.categoryId),
  ]);
  const spentBy = new Map(spent.map((s) => [s.categoryId, s.total]));
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    monthlyLimit: c.monthlyLimit,
    position: c.position,
    spent: spentBy.get(c.id) ?? 0,
  }));
}

const expenseSelect = {
  id: expenses.id,
  amount: expenses.amount,
  date: expenses.date,
  note: expenses.note,
  envelopeId: expenses.envelopeId,
  categoryId: expenses.categoryId,
  targetName: sql<string>`coalesce(${envelopes.name}, ${spendCategories.name}, '')`,
  categoryName: spendCategories.name,
  envelopeName: envelopes.name,
};

/**
 * Latest expenses, newest first. "spending" is what the Spending screen
 * shows: every expense with a category, daily or from an envelope.
 */
export async function loadExpenses(
  userId: string,
  filter: {
    kind?: "spending" | "envelope";
    envelopeId?: string;
    categoryId?: string;
    limit?: number;
  } = {},
): Promise<ExpenseView[]> {
  const conditions = [eq(expenses.userId, userId)];
  if (filter.kind === "spending")
    conditions.push(isNotNull(expenses.categoryId));
  if (filter.kind === "envelope")
    conditions.push(isNotNull(expenses.envelopeId));
  if (filter.envelopeId)
    conditions.push(eq(expenses.envelopeId, filter.envelopeId));
  if (filter.categoryId)
    conditions.push(eq(expenses.categoryId, filter.categoryId));

  return getDb()
    .select(expenseSelect)
    .from(expenses)
    .leftJoin(envelopes, eq(expenses.envelopeId, envelopes.id))
    .leftJoin(spendCategories, eq(expenses.categoryId, spendCategories.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(filter.limit ?? 20);
}

export async function loadExpense(
  userId: string,
  id: string,
): Promise<ExpenseView | null> {
  const [row] = await getDb()
    .select(expenseSelect)
    .from(expenses)
    .leftJoin(envelopes, eq(expenses.envelopeId, envelopes.id))
    .leftJoin(spendCategories, eq(expenses.categoryId, spendCategories.id))
    .where(and(eq(expenses.userId, userId), eq(expenses.id, id)));
  return row ?? null;
}

/**
 * Envelope and category ids of recent expenses, newest first. Categories come
 * from all expenses, envelope ones included; deleted categories are skipped.
 */
export async function loadRecentTargetIds(
  userId: string,
): Promise<{ envelopes: string[]; categories: string[] }> {
  const rows = await getDb()
    .select({
      envelopeId: expenses.envelopeId,
      categoryId: expenses.categoryId,
      categoryDeletedAt: spendCategories.deletedAt,
    })
    .from(expenses)
    .leftJoin(spendCategories, eq(expenses.categoryId, spendCategories.id))
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.createdAt))
    .limit(50);
  return {
    envelopes: rows.flatMap((r) => (r.envelopeId ? [r.envelopeId] : [])),
    categories: rows.flatMap((r) =>
      r.categoryId && !r.categoryDeletedAt ? [r.categoryId] : [],
    ),
  };
}

/** Spent from the daily budget: expenses that are not from an envelope. */
export async function loadDailySpent(
  userId: string,
  since: string,
): Promise<number> {
  const [row] = await getDb()
    .select({
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        isNull(expenses.envelopeId),
        gte(expenses.date, since),
      ),
    );
  return row?.total ?? 0;
}

/**
 * Everything spent under a category since the given day, daily and from
 * envelopes, deleted categories included.
 */
export async function loadMonthSpent(
  userId: string,
  since: string,
): Promise<number> {
  const [row] = await getDb()
    .select({
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)::int`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        isNotNull(expenses.categoryId),
        gte(expenses.date, since),
      ),
    );
  return row?.total ?? 0;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
