import { notFound } from "next/navigation";
import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import {
  isUuid,
  loadExpense,
  loadLatestIncome,
  periodStart,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { ExpenseForm } from "../expense-form";
import { loadPickers, safeBackHref } from "../load-pickers";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const expense = await loadExpense(userId, id);
  if (!expense) notFound();

  const from = (await searchParams).from;
  const backHref = safeBackHref(
    from ??
      (expense.categoryId ? "/daily" : `/envelopes/${expense.envelopeId}`),
  );
  const income = await loadLatestIncome(userId);
  const pickers = await loadPickers(userId, periodStart(income));

  return (
    <Screen>
      <CloseHeader title="Трата" closeHref={backHref} />
      <ExpenseForm
        {...pickers}
        initial={{
          id: expense.id,
          amount: expense.amount,
          date: expense.date,
          note: expense.note,
          envelopeId: expense.envelopeId,
          categoryId: expense.categoryId,
        }}
        initialMode={expense.categoryId ? "daily" : "envelope"}
        backHref={backHref}
        today={todayIso()}
      />
    </Screen>
  );
}
