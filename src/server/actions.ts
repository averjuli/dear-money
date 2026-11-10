"use server";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@/db/client";
import {
  allocations,
  dailyMoves,
  envelopes,
  expenses,
  incomes,
  payDays,
  spendCategories,
  transfers,
  wallets,
} from "@/db/schema";
import { planAllocation } from "@/domain/allocation";
import { dailyMove, expenseDailyEffect } from "@/domain/daily";
import { PERIOD_UNITS, type PeriodUnit } from "@/domain/envelope";
import {
  canTransfer,
  transferDailyEffect,
  type SavedTransfer,
  type TransferSide,
} from "@/domain/transfer";
import { getAuth } from "./auth/auth";
import { requireUserId } from "./auth/current-user";
import { normalizeEmail } from "./auth/email";
import {
  isUuid,
  loadLatestIncome,
  loadTransfer,
  loadWallets,
  toAllocationInput,
} from "./queries";
import { isIsoDate, todayIso } from "./today";

export type ActionResult =
  { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

const MAX_MONEY = 2_000_000_000; // integer column limit in kopecks

function isMoney(
  value: unknown,
  { allowNegative = false } = {},
): value is number {
  return (
    Number.isSafeInteger(value) &&
    Math.abs(value as number) <= MAX_MONEY &&
    (allowNegative || (value as number) >= 0)
  );
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > 0 && name.length <= 80 ? name : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Writes what a saved or deleted item (a transfer or a daily expense) changes
 * in «на жизнь» into the journal: the effect it has now minus what its earlier
 * rows already added, in the period of the latest income, whatever the item's
 * date. No row when nothing changes or before the first allocation.
 * Call it in the same transaction as the change itself.
 */
async function recordDailyMove(
  tx: Tx,
  userId: string,
  item: { source: "transfer" | "expense"; id: string },
  effect: number,
): Promise<void> {
  const [income] = await tx
    .select({ id: incomes.id })
    .from(incomes)
    .where(eq(incomes.userId, userId))
    .orderBy(desc(incomes.date), desc(incomes.createdAt))
    .limit(1);
  if (!income) return;
  const [row] = await tx
    .select({
      total: sql<number>`coalesce(sum(${dailyMoves.amount}), 0)::int`,
    })
    .from(dailyMoves)
    .where(
      and(
        eq(dailyMoves.userId, userId),
        item.source === "expense"
          ? eq(dailyMoves.expenseId, item.id)
          : eq(dailyMoves.transferId, item.id),
      ),
    );
  const amount = dailyMove({ effect, journaled: row?.total ?? 0 });
  if (amount === 0) return;
  await tx.insert(dailyMoves).values({
    userId,
    incomeId: income.id,
    source: item.source,
    expenseId: item.source === "expense" ? item.id : null,
    transferId: item.source === "transfer" ? item.id : null,
    amount,
  });
}

// ---------- Auth ----------

export type SignInLinkState = {
  /** What the person typed, kept in the field. */
  typed: string;
  /** The normalized address the link went to. */
  sentTo?: string;
  /** A message to show under the form. */
  error?: "email" | "too-often" | "failed";
} | null;

/**
 * Sends a sign-in link. The address is checked and the limit applied by the
 * Better Auth hook, so a request that does not come from this form is
 * treated the same way. A new and a known address get the same answer.
 */
export async function requestSignInLink(
  _prev: SignInLinkState,
  formData: FormData,
): Promise<SignInLinkState> {
  const typed = String(formData.get("email") ?? "");
  const email = normalizeEmail(typed);
  try {
    await getAuth().api.signInMagicLink({
      body: {
        email,
        callbackURL: "/",
        newUserCallbackURL: "/",
        errorCallbackURL: "/login/expired",
      },
      headers: await headers(),
    });
  } catch (error) {
    // Not `instanceof APIError`: the class can be a different copy here and in Better Auth.
    const status = (error as { statusCode?: unknown } | null)?.statusCode;
    // The only field of the request is the address: any 400 is about it.
    if (status === 400) return { typed, error: "email" };
    if (status === 429) return { typed, error: "too-often" };
    console.error("Sign-in link was not sent:", error);
    return { typed, error: "failed" };
  }
  return { typed: email, sentTo: email };
}

/** Signs out on this device only; other devices stay signed in. */
export async function logout(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}

// ---------- Income ----------

const INCOME_KINDS = ["salary", "advance", "other"] as const;

/** A day of the month, 1 to 31, or null when it is not set. */
function isDayOfMonth(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 31)
  );
}

export async function allocateIncome(input: {
  amount: number;
  kind: (typeof INCOME_KINDS)[number];
  date: string;
  /** Days of the month when the advance and the salary arrive; null = not set. */
  advanceDay: number | null;
  salaryDay: number | null;
  /** Wallets unchecked on the allocation screen; used only if money is short. */
  skippedWalletIds?: string[];
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isMoney(input.amount) || input.amount <= 0) {
    return fail("Введите сумму больше нуля");
  }
  if (!INCOME_KINDS.includes(input.kind)) return fail("Неизвестный вид дохода");
  if (!isIsoDate(input.date)) return fail("Неверная дата");
  if (!isDayOfMonth(input.advanceDay) || !isDayOfMonth(input.salaryDay)) {
    return fail("Число от 1 до 31");
  }

  // Plan again on the server from current balances; the client preview is not trusted.
  const { wallets: w, envelopes: e } = toAllocationInput(
    await loadWallets(userId),
  );
  const ownWalletIds = new Set(w.map((wallet) => wallet.id));
  const skippedWalletIds = (input.skippedWalletIds ?? []).filter(
    (id) => isUuid(id) && ownWalletIds.has(id),
  );
  const plan = planAllocation(w, e, input.amount, skippedWalletIds);

  await getDb().transaction(async (tx) => {
    const [income] = await tx
      .insert(incomes)
      .values({
        userId,
        date: input.date,
        amount: input.amount,
        kind: input.kind,
        toEnvelopes: plan.toEnvelopes,
        toDaily: plan.toDaily,
      })
      .returning({ id: incomes.id });
    if (plan.lines.length > 0) {
      await tx.insert(allocations).values(
        plan.lines.map((line) => ({
          userId,
          incomeId: income.id,
          envelopeId: line.envelopeId,
          amount: line.amount,
          kind: line.kind,
          sourceEnvelopeId: line.sourceEnvelopeId,
        })),
      );
    }
    // The days are remembered together with the income: all or nothing.
    await tx
      .insert(payDays)
      .values({
        userId,
        advanceDay: input.advanceDay,
        salaryDay: input.salaryDay,
      })
      .onConflictDoUpdate({
        target: payDays.userId,
        set: { advanceDay: input.advanceDay, salaryDay: input.salaryDay },
      });
  });
  refresh();
  return { ok: true };
}

// ---------- Expenses ----------

export async function saveExpense(input: {
  id?: string;
  amount: number;
  date: string;
  note: string;
  envelopeId: string | null;
  categoryId: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isMoney(input.amount) || input.amount <= 0) {
    return fail("Введите сумму больше нуля");
  }
  if (!isIsoDate(input.date)) return fail("Неверная дата");
  // A category is always required: for a daily expense it is the source,
  // for an envelope expense it says what the money was spent on.
  if (input.categoryId === null) {
    return fail(
      input.envelopeId === null
        ? "Выберите, откуда списать"
        : "Выберите категорию",
    );
  }
  if (!isUuid(input.categoryId)) return fail("Категория не найдена");
  const note =
    typeof input.note === "string" ? input.note.trim().slice(0, 200) : "";
  const db = getDb();

  if (input.envelopeId !== null) {
    if (!isUuid(input.envelopeId)) return fail("Конверт не найден");
    const [owned] = await db
      .select({ id: envelopes.id })
      .from(envelopes)
      .where(
        and(eq(envelopes.id, input.envelopeId), eq(envelopes.userId, userId)),
      );
    if (!owned) return fail("Конверт не найден");
  }

  const [category] = await db
    .select({ deletedAt: spendCategories.deletedAt })
    .from(spendCategories)
    .where(
      and(
        eq(spendCategories.id, input.categoryId),
        eq(spendCategories.userId, userId),
      ),
    );
  if (!category) return fail("Категория не найдена");
  if (category.deletedAt) {
    // A deleted category can stay only on the expense that already has it.
    const [current] =
      input.id && isUuid(input.id)
        ? await db
            .select({ categoryId: expenses.categoryId })
            .from(expenses)
            .where(and(eq(expenses.id, input.id), eq(expenses.userId, userId)))
        : [];
    if (current?.categoryId !== input.categoryId) {
      return fail("Категория не найдена");
    }
  }

  const values = {
    amount: input.amount,
    date: input.date,
    note: note === "" ? null : note,
    envelopeId: input.envelopeId,
    categoryId: input.categoryId,
  };

  const effect = expenseDailyEffect({
    amount: input.amount,
    envelopeId: input.envelopeId,
  });

  if (input.id) {
    const id = input.id;
    if (!isUuid(id)) return fail("Трата не найдена");
    const found = await db.transaction(async (tx) => {
      const updated = await tx
        .update(expenses)
        .set(values)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning({ id: expenses.id });
      if (updated.length === 0) return false;
      await recordDailyMove(tx, userId, { source: "expense", id }, effect);
      return true;
    });
    if (!found) return fail("Трата не найдена");
    refresh();
    return { ok: true, id };
  }

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expenses)
      .values({ userId, ...values })
      .returning({ id: expenses.id });
    await recordDailyMove(
      tx,
      userId,
      { source: "expense", id: created.id },
      effect,
    );
    return created.id;
  });
  refresh();
  return { ok: true, id: createdId };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Трата не найдена");
  await getDb().transaction(async (tx) => {
    const [found] = await tx
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    if (!found) return;
    // The row goes first: it still points to the expense, which is then deleted.
    await recordDailyMove(tx, userId, { source: "expense", id }, 0);
    await tx
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  });
  refresh();
  return { ok: true };
}

// ---------- Transfers ----------

/** Accepts only the three known shapes of a transfer side. */
function parseSide(value: unknown): TransferSide | null {
  if (typeof value !== "object" || value === null) return null;
  const side = value as { kind?: unknown; envelopeId?: unknown };
  if (side.kind === "daily") return { kind: "daily" };
  if (side.kind === "deleted") return { kind: "deleted" };
  if (side.kind === "envelope" && isUuid(side.envelopeId)) {
    return { kind: "envelope", envelopeId: side.envelopeId };
  }
  return null;
}

export async function saveTransfer(input: {
  id?: string;
  amount: number;
  from: TransferSide | null;
  to: TransferSide | null;
  date: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isMoney(input.amount) || input.amount <= 0) {
    return fail("Введите сумму больше нуля");
  }
  if (!isIsoDate(input.date)) return fail("Неверная дата");
  const today = todayIso();
  if (input.date > today) return fail("Дата не может быть позже сегодняшней");
  const from = parseSide(input.from);
  const to = parseSide(input.to);
  if (from === null || to === null) return fail("Выберите, откуда и куда");

  let initial: SavedTransfer | null = null;
  if (input.id !== undefined) {
    if (!isUuid(input.id)) return fail("Перевод не найден");
    const saved = await loadTransfer(userId, input.id);
    if (!saved) return fail("Перевод не найден");
    initial = { amount: saved.amount, from: saved.from, to: saved.to };
  }

  const dailyAvailable = (await loadLatestIncome(userId)) !== null;
  if (!dailyAvailable && (from.kind === "daily" || to.kind === "daily")) {
    return fail("Сначала разложите деньги");
  }
  if (
    !canTransfer({
      amount: input.amount,
      from,
      to,
      date: input.date,
      today,
      dailyAvailable,
      initial,
    })
  ) {
    return fail("Откуда и куда должны различаться");
  }

  const db = getDb();
  const envelopeIds = [from, to].flatMap((side) =>
    side.kind === "envelope" ? [side.envelopeId] : [],
  );
  if (envelopeIds.length > 0) {
    const owned = await db
      .select({ id: envelopes.id })
      .from(envelopes)
      .where(
        and(eq(envelopes.userId, userId), inArray(envelopes.id, envelopeIds)),
      );
    if (owned.length !== new Set(envelopeIds).size) {
      return fail("Конверт не найден");
    }
  }

  const values = {
    amount: input.amount,
    date: input.date,
    fromDaily: from.kind === "daily",
    fromEnvelopeId: from.kind === "envelope" ? from.envelopeId : null,
    toDaily: to.kind === "daily",
    toEnvelopeId: to.kind === "envelope" ? to.envelopeId : null,
  };
  const effect = transferDailyEffect({ amount: input.amount, from, to });

  const id = await db.transaction(async (tx) => {
    if (input.id !== undefined) {
      const id = input.id;
      await tx
        .update(transfers)
        .set(values)
        .where(and(eq(transfers.id, id), eq(transfers.userId, userId)));
      await recordDailyMove(tx, userId, { source: "transfer", id }, effect);
      return id;
    }
    const [created] = await tx
      .insert(transfers)
      .values({ userId, ...values })
      .returning({ id: transfers.id });
    await recordDailyMove(
      tx,
      userId,
      { source: "transfer", id: created.id },
      effect,
    );
    return created.id;
  });
  refresh();
  return { ok: true, id };
}

export async function deleteTransfer(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Перевод не найден");
  const found = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ id: transfers.id })
      .from(transfers)
      .where(and(eq(transfers.id, id), eq(transfers.userId, userId)));
    if (!row) return false;
    // The row goes first: it still points to the transfer, which is then deleted.
    await recordDailyMove(tx, userId, { source: "transfer", id }, 0);
    await tx
      .delete(transfers)
      .where(and(eq(transfers.id, id), eq(transfers.userId, userId)));
    return true;
  });
  if (!found) return fail("Перевод не найден");
  refresh();
  return { ok: true };
}

// ---------- Envelopes ----------

export interface EnvelopeInput {
  id?: string;
  walletId: string;
  name: string;
  costPerTime: number;
  periodN: number;
  periodUnit: PeriodUnit;
  contributionOverride: number | null;
  timesToSave: number;
  startBalance: number;
}

export async function saveEnvelope(
  input: EnvelopeInput,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const name = cleanName(input.name);
  if (!name) return fail("Введите название конверта");
  if (!isMoney(input.costPerTime)) return fail("Введите стоимость");
  if (
    !Number.isSafeInteger(input.periodN) ||
    input.periodN < 1 ||
    input.periodN > 1000
  ) {
    return fail("Частота: от 1 и больше");
  }
  if (!PERIOD_UNITS.includes(input.periodUnit))
    return fail("Неверная единица времени");
  if (
    input.contributionOverride !== null &&
    !isMoney(input.contributionOverride)
  ) {
    return fail("Неверный взнос вручную");
  }
  if (
    !Number.isSafeInteger(input.timesToSave) ||
    input.timesToSave < 1 ||
    input.timesToSave > 100
  ) {
    return fail("Копить можно на 1 раз и больше");
  }
  if (!isMoney(input.startBalance, { allowNegative: true })) {
    return fail("Неверный начальный остаток");
  }
  if (!isUuid(input.walletId)) return fail("Кошелёк не найден");

  const db = getDb();
  const [wallet] = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.id, input.walletId), eq(wallets.userId, userId)));
  if (!wallet) return fail("Кошелёк не найден");

  const values = {
    name,
    costPerTime: input.costPerTime,
    periodN: input.periodN,
    periodUnit: input.periodUnit,
    contributionOverride: input.contributionOverride,
    timesToSave: input.timesToSave,
    startBalance: input.startBalance,
  };

  if (input.id) {
    if (!isUuid(input.id)) return fail("Конверт не найден");
    const updated = await db
      .update(envelopes)
      .set(values)
      .where(and(eq(envelopes.id, input.id), eq(envelopes.userId, userId)))
      .returning({ id: envelopes.id });
    if (updated.length === 0) return fail("Конверт не найден");
    refresh();
    return { ok: true, id: input.id };
  }

  const [{ next }] = await db
    .select({
      next: sql<number>`coalesce(max(${envelopes.priority}), 0)::int + 1`,
    })
    .from(envelopes)
    .where(
      and(eq(envelopes.walletId, wallet.id), eq(envelopes.userId, userId)),
    );
  const [created] = await db
    .insert(envelopes)
    .values({ userId, walletId: wallet.id, priority: next, ...values })
    .returning({ id: envelopes.id });
  refresh();
  return { ok: true, id: created.id };
}

async function renumberEnvelopes(userId: string, walletId: string) {
  await getDb().execute(sql`
    update ${envelopes} e set priority = r.rn
    from (
      select id, row_number() over (order by priority, created_at) as rn
      from ${envelopes}
      where wallet_id = ${walletId} and user_id = ${userId}
    ) r
    where e.id = r.id
  `);
}

export async function deleteEnvelope(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Конверт не найден");
  const [deleted] = await getDb()
    .delete(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .returning({ walletId: envelopes.walletId });
  if (!deleted) return fail("Конверт не найден");
  await renumberEnvelopes(userId, deleted.walletId);
  refresh();
  return { ok: true };
}

/** Saves a new priority order: ids in order, priority 1 is the most important. */
export async function reorderEnvelopes(
  walletId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(walletId) || !orderedIds.every(isUuid))
    return fail("Неверный порядок");
  const db = getDb();
  const current = await db
    .select({ id: envelopes.id })
    .from(envelopes)
    .where(and(eq(envelopes.walletId, walletId), eq(envelopes.userId, userId)));
  const known = new Set(current.map((e) => e.id));
  if (
    orderedIds.length !== known.size ||
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => known.has(id))
  ) {
    return fail("Список конвертов изменился, обновите страницу");
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(envelopes)
        .set({ priority: index + 1 })
        .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)));
    }
  });
  refresh();
  return { ok: true };
}

// ---------- Wallets ----------

export async function saveWallet(input: {
  id?: string;
  name: string;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const name = cleanName(input.name);
  if (!name) return fail("Введите название кошелька");
  const db = getDb();
  if (input.id) {
    if (!isUuid(input.id)) return fail("Кошелёк не найден");
    const updated = await db
      .update(wallets)
      .set({ name })
      .where(and(eq(wallets.id, input.id), eq(wallets.userId, userId)))
      .returning({ id: wallets.id });
    if (updated.length === 0) return fail("Кошелёк не найден");
    refresh();
    return { ok: true, id: input.id };
  }
  const [{ next }] = await db
    .select({
      next: sql<number>`coalesce(max(${wallets.position}), 0)::int + 1`,
    })
    .from(wallets)
    .where(eq(wallets.userId, userId));
  const [created] = await db
    .insert(wallets)
    .values({ userId, name, position: next })
    .returning({ id: wallets.id });
  refresh();
  return { ok: true, id: created.id };
}

export async function deleteWallet(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Кошелёк не найден");
  await getDb()
    .delete(wallets)
    .where(and(eq(wallets.id, id), eq(wallets.userId, userId)));
  refresh();
  return { ok: true };
}

export async function reorderWallets(
  orderedIds: string[],
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!orderedIds.every(isUuid)) return fail("Неверный порядок");
  const db = getDb();
  const current = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(eq(wallets.userId, userId));
  const known = new Set(current.map((w) => w.id));
  if (
    orderedIds.length !== known.size ||
    new Set(orderedIds).size !== orderedIds.length ||
    !orderedIds.every((id) => known.has(id))
  ) {
    return fail("Список кошельков изменился, обновите страницу");
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(wallets)
        .set({ position: index + 1 })
        .where(and(eq(wallets.id, id), eq(wallets.userId, userId)));
    }
  });
  refresh();
  return { ok: true };
}

// ---------- Daily categories ----------

export async function saveCategory(input: {
  id?: string;
  name: string;
  monthlyLimit: number | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  const name = cleanName(input.name);
  if (!name) return fail("Введите название категории");
  if (
    input.monthlyLimit !== null &&
    (!isMoney(input.monthlyLimit) || input.monthlyLimit === 0)
  ) {
    return fail("Лимит должен быть больше нуля или пустым");
  }
  const db = getDb();
  if (input.id) {
    if (!isUuid(input.id)) return fail("Категория не найдена");
    const updated = await db
      .update(spendCategories)
      .set({ name, monthlyLimit: input.monthlyLimit })
      .where(
        and(
          eq(spendCategories.id, input.id),
          eq(spendCategories.userId, userId),
          isNull(spendCategories.deletedAt),
        ),
      )
      .returning({ id: spendCategories.id });
    if (updated.length === 0) return fail("Категория не найдена");
    refresh();
    return { ok: true, id: input.id };
  }
  const [{ next }] = await db
    .select({
      next: sql<number>`coalesce(max(${spendCategories.position}), 0)::int + 1`,
    })
    .from(spendCategories)
    .where(eq(spendCategories.userId, userId));
  const [created] = await db
    .insert(spendCategories)
    .values({ userId, name, monthlyLimit: input.monthlyLimit, position: next })
    .returning({ id: spendCategories.id });
  refresh();
  return { ok: true, id: created.id };
}

/** Hides the category; its expenses stay in the history and in all sums. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Категория не найдена");
  await getDb()
    .update(spendCategories)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(spendCategories.id, id),
        eq(spendCategories.userId, userId),
        isNull(spendCategories.deletedAt),
      ),
    );
  refresh();
  return { ok: true };
}
