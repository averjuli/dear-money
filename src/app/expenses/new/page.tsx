import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { dailySummary, monthStart } from "@/domain/daily";
import {
  loadDailySpent,
  loadLatestIncome,
  periodStart,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { ExpenseForm } from "../expense-form";
import { loadPickers, safeBackHref } from "../load-pickers";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const backHref = safeBackHref((await searchParams).from);
  const today = todayIso();
  const pickers = await loadPickers(userId, monthStart(today));
  // What is left for daily life: the hint under a daily expense.
  const income = await loadLatestIncome(userId);
  const remaining = income
    ? dailySummary({
        budget: income.toDaily,
        spent: await loadDailySpent(userId, periodStart(income)),
        today,
        nextIncomeDate: income.nextIncomeDate,
      }).remaining
    : null;

  return (
    <Screen>
      <CloseHeader title="Новая трата" closeHref={backHref} />
      <ExpenseForm
        {...pickers}
        initial={null}
        initialMode={backHref.startsWith("/daily") ? "daily" : "envelope"}
        backHref={backHref}
        today={today}
        dailyRemaining={remaining}
      />
    </Screen>
  );
}
