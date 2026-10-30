"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  allocations,
  envelopes,
  expenses,
  incomes,
  spendCategories,
  users,
  wallets,
} from "@/db/schema";
import { planAllocation } from "@/domain/allocation";
import { PERIOD_UNITS, type PeriodUnit } from "@/domain/envelope";
import {
  authSecret,
  isAuthConfigured,
  requireUserId,
} from "./auth/current-user";
import { verifyPassword } from "./auth/password";
import {
  SESSION_COOKIE,
  sessionMaxAgeSeconds,
  signSession,
} from "./auth/session";
import { isUuid, loadWallets, toAllocationInput } from "./queries";
import { isIsoDate } from "./today";

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

// ---------- Auth ----------

export async function login(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  if (!isAuthConfigured()) {
    return { error: "Вход ещё не настроен: выполните pnpm auth:setup" };
  }
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.AUTH_USERNAME!.trim();
  const passwordOk = await verifyPassword(
    password,
    process.env.AUTH_PASSWORD_HASH!,
  );
  if (username !== expectedUser || !passwordOk) {
    return { error: "Неверный логин или пароль" };
  }

  const db = getDb();
  await db.insert(users).values({ login: username }).onConflictDoNothing();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.login, username));

  const token = await signSession({ userId: user.id }, authSecret()!);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- Income ----------

const INCOME_KINDS = ["salary", "advance", "other"] as const;

export async function allocateIncome(input: {
  amount: number;
  kind: (typeof INCOME_KINDS)[number];
  date: string;
  nextIncomeDate: string | null;
}): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isMoney(input.amount) || input.amount <= 0) {
    return fail("Введите сумму больше нуля");
  }
  if (!INCOME_KINDS.includes(input.kind)) return fail("Неизвестный вид дохода");
  if (!isIsoDate(input.date)) return fail("Неверная дата");
  if (input.nextIncomeDate !== null) {
    if (!isIsoDate(input.nextIncomeDate))
      return fail("Неверная дата следующего дохода");
    if (input.nextIncomeDate <= input.date) {
      return fail("Следующие деньги должны прийти позже сегодняшних");
    }
  }

  // Plan again on the server from current balances; the client preview is not trusted.
  const { wallets: w, envelopes: e } = toAllocationInput(
    await loadWallets(userId),
  );
  const plan = planAllocation(w, e, input.amount);

  await getDb().transaction(async (tx) => {
    const [income] = await tx
      .insert(incomes)
      .values({
        userId,
        date: input.date,
        amount: input.amount,
        kind: input.kind,
        nextIncomeDate: input.nextIncomeDate,
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
  if ((input.envelopeId === null) === (input.categoryId === null)) {
    return fail("Выберите, откуда списать");
  }
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
  } else {
    if (!isUuid(input.categoryId)) return fail("Категория не найдена");
    const [owned] = await db
      .select({ id: spendCategories.id })
      .from(spendCategories)
      .where(
        and(
          eq(spendCategories.id, input.categoryId),
          eq(spendCategories.userId, userId),
        ),
      );
    if (!owned) return fail("Категория не найдена");
  }

  const values = {
    amount: input.amount,
    date: input.date,
    note: note === "" ? null : note,
    envelopeId: input.envelopeId,
    categoryId: input.categoryId,
  };

  if (input.id) {
    if (!isUuid(input.id)) return fail("Трата не найдена");
    const updated = await db
      .update(expenses)
      .set(values)
      .where(and(eq(expenses.id, input.id), eq(expenses.userId, userId)))
      .returning({ id: expenses.id });
    if (updated.length === 0) return fail("Трата не найдена");
    refresh();
    return { ok: true, id: input.id };
  }

  const [created] = await db
    .insert(expenses)
    .values({ userId, ...values })
    .returning({ id: expenses.id });
  refresh();
  return { ok: true, id: created.id };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Трата не найдена");
  await getDb()
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
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

export async function deleteCategory(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!isUuid(id)) return fail("Категория не найдена");
  await getDb()
    .delete(spendCategories)
    .where(and(eq(spendCategories.id, id), eq(spendCategories.userId, userId)));
  refresh();
  return { ok: true };
}
