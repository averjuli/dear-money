import { notFound } from "next/navigation";
import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { monthStart } from "@/domain/daily";
import { isUuid, loadExpense } from "@/server/queries";
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
      (expense.envelopeId ? `/envelopes/${expense.envelopeId}` : "/daily"),
  );
  const today = todayIso();
  const pickers = await loadPickers(userId, monthStart(today));
  // The category of this expense may have been deleted: keep it selectable.
  const keptCategory =
    expense.categoryId &&
    expense.categoryName &&
    !pickers.categories.some((c) => c.id === expense.categoryId)
      ? { id: expense.categoryId, name: expense.categoryName }
      : null;

  return (
    <Screen>
      <CloseHeader title="Трата" closeHref={backHref} />
      <ExpenseForm
        {...pickers}
        keptCategory={keptCategory}
        initial={{
          id: expense.id,
          amount: expense.amount,
          date: expense.date,
          note: expense.note,
          envelopeId: expense.envelopeId,
          categoryId: expense.categoryId,
        }}
        initialMode={expense.envelopeId ? "envelope" : "daily"}
        backHref={backHref}
        today={today}
      />
    </Screen>
  );
}
