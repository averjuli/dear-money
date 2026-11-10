import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { monthStart } from "@/domain/daily";
import { loadDailySummary } from "@/server/queries";
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
  const daily = await loadDailySummary(userId, today);

  return (
    <Screen>
      <CloseHeader title="Новая трата" closeHref={backHref} />
      <ExpenseForm
        {...pickers}
        initial={null}
        initialMode={backHref.startsWith("/daily") ? "daily" : "envelope"}
        backHref={backHref}
        today={today}
        dailyRemaining={daily?.summary.remaining ?? null}
      />
    </Screen>
  );
}
