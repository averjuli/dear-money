import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import {
  allocations,
  envelopes,
  expenses,
  dailyMoves,
  incomes,
  payDays,
  spendCategories,
  transfers,
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
import type { TransferSide } from "@/domain/transfer";
import {
  dailyRemaining,
  dailySummary,
  type DailySummary,
} from "@/domain/daily";

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
  const [walletRows, envelopeRows, allocated, spent, movedIn, movedOut] =
    await Promise.all([
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
      db
        .select({
          envelopeId: transfers.toEnvelopeId,
          total: sql<number>`coalesce(sum(${transfers.amount}), 0)::int`,
        })
        .from(transfers)
        .where(
          and(eq(transfers.userId, userId), isNotNull(transfers.toEnvelopeId)),
        )
        .groupBy(transfers.toEnvelopeId),
      db
        .select({
          envelopeId: transfers.fromEnvelopeId,
          total: sql<number>`coalesce(sum(${transfers.amount}), 0)::int`,
        })
        .from(transfers)
        .where(
          and(
            eq(transfers.userId, userId),
            isNotNull(transfers.fromEnvelopeId),
          ),
        )
        .groupBy(transfers.fromEnvelopeId),
    ]);

  const allocatedBy = new Map(allocated.map((a) => [a.envelopeId, a.total]));
  const spentBy = new Map(spent.map((s) => [s.envelopeId, s]));
  const movedInBy = new Map(movedIn.map((t) => [t.envelopeId, t.total]));
  const movedOutBy = new Map(movedOut.map((t) => [t.envelopeId, t.total]));

  const views: EnvelopeView[] = envelopeRows.map((e) => {
    const balance = envelopeBalance({
      startBalance: e.startBalance,
      allocated: allocatedBy.get(e.id) ?? 0,
      spent: spentBy.get(e.id)?.total ?? 0,
      transferredIn: movedInBy.get(e.id) ?? 0,
      transferredOut: movedOutBy.get(e.id) ?? 0,
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
    toDaily: row.toDaily,
  };
}

/** The advance and salary days of the month saved with the last allocation. */
export async function loadPayDays(
  userId: string,
): Promise<{ advanceDay: number | null; salaryDay: number | null }> {
  const [row] = await getDb()
    .select({ advanceDay: payDays.advanceDay, salaryDay: payDays.salaryDay })
    .from(payDays)
    .where(eq(payDays.userId, userId))
    .limit(1);
  return row ?? { advanceDay: null, salaryDay: null };
}

/**
 * «Осталось на жизнь» is a running balance: the shares of all incomes for
 * daily spending plus every journal row (transfers and daily expenses).
 * Null until the first income is allocated.
 */
export async function loadDailySummary(
  userId: string,
  today: string,
): Promise<{ summary: DailySummary } | null> {
  const db = getDb();
  // Sums are cast to text: over the years they can outgrow a 32-bit integer.
  const [[incomeTotals], [moveTotals], days] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        toDaily: sql<string>`coalesce(sum(${incomes.toDaily}), 0)::text`,
      })
      .from(incomes)
      .where(eq(incomes.userId, userId)),
    db
      .select({
        total: sql<string>`coalesce(sum(${dailyMoves.amount}), 0)::text`,
      })
      .from(dailyMoves)
      .where(eq(dailyMoves.userId, userId)),
    loadPayDays(userId),
  ]);
  if (incomeTotals.count === 0) return null;
  const summary = dailySummary({
    remaining: dailyRemaining({
      toDaily: [Number(incomeTotals.toDaily)],
      moves: [Number(moveTotals.total)],
    }),
    today,
    payDays: [days.advanceDay, days.salaryDay],
  });
  return { summary };
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

/** One expense with what it has already added to «на жизнь» (journal rows). */
export async function loadExpense(
  userId: string,
  id: string,
): Promise<(ExpenseView & { journaled: number }) | null> {
  const [row] = await getDb()
    .select({
      ...expenseSelect,
      journaled: sql<number>`coalesce((select sum(${dailyMoves.amount}) from ${dailyMoves} where ${dailyMoves.expenseId} = ${expenses.id}), 0)::int`,
    })
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

export interface TransferView {
  id: string;
  amount: number;
  date: string;
  from: TransferSide;
  to: TransferSide;
  /** Envelope names, null for «на жизнь» and for a deleted envelope. */
  fromName: string | null;
  toName: string | null;
  /** Everything this transfer has already added to «на жизнь». */
  journaled: number;
}

const fromEnvelope = alias(envelopes, "from_envelope");
const toEnvelope = alias(envelopes, "to_envelope");

const transferSelect = {
  id: transfers.id,
  amount: transfers.amount,
  date: transfers.date,
  fromDaily: transfers.fromDaily,
  fromEnvelopeId: transfers.fromEnvelopeId,
  toDaily: transfers.toDaily,
  toEnvelopeId: transfers.toEnvelopeId,
  fromName: fromEnvelope.name,
  toName: toEnvelope.name,
  journaled: sql<number>`coalesce((select sum(${dailyMoves.amount}) from ${dailyMoves} where ${dailyMoves.transferId} = ${transfers.id}), 0)::int`,
};

function toSide(daily: boolean, envelopeId: string | null): TransferSide {
  if (daily) return { kind: "daily" };
  if (envelopeId) return { kind: "envelope", envelopeId };
  return { kind: "deleted" };
}

function toTransferView(row: {
  id: string;
  amount: number;
  date: string;
  fromDaily: boolean;
  fromEnvelopeId: string | null;
  toDaily: boolean;
  toEnvelopeId: string | null;
  fromName: string | null;
  toName: string | null;
  journaled: number;
}): TransferView {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date,
    from: toSide(row.fromDaily, row.fromEnvelopeId),
    to: toSide(row.toDaily, row.toEnvelopeId),
    fromName: row.fromName,
    toName: row.toName,
    journaled: row.journaled,
  };
}

/**
 * Transfers of one side, newest first by their date: of an envelope (from it
 * and to it) or of «на жизнь».
 */
export async function loadTransfers(
  userId: string,
  side: { envelopeId: string } | { daily: true },
  limit = 10,
): Promise<TransferView[]> {
  const sideCondition =
    "envelopeId" in side
      ? or(
          eq(transfers.fromEnvelopeId, side.envelopeId),
          eq(transfers.toEnvelopeId, side.envelopeId),
        )
      : or(eq(transfers.fromDaily, true), eq(transfers.toDaily, true));
  const rows = await getDb()
    .select(transferSelect)
    .from(transfers)
    .leftJoin(fromEnvelope, eq(transfers.fromEnvelopeId, fromEnvelope.id))
    .leftJoin(toEnvelope, eq(transfers.toEnvelopeId, toEnvelope.id))
    .where(and(eq(transfers.userId, userId), sideCondition))
    .orderBy(desc(transfers.date), desc(transfers.createdAt))
    .limit(limit);
  return rows.map(toTransferView);
}

export async function loadTransfer(
  userId: string,
  id: string,
): Promise<TransferView | null> {
  const [row] = await getDb()
    .select(transferSelect)
    .from(transfers)
    .leftJoin(fromEnvelope, eq(transfers.fromEnvelopeId, fromEnvelope.id))
    .leftJoin(toEnvelope, eq(transfers.toEnvelopeId, toEnvelope.id))
    .where(and(eq(transfers.userId, userId), eq(transfers.id, id)));
  return row ? toTransferView(row) : null;
}
