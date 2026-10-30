import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { loadLatestIncome, periodStart } from "@/server/queries";
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
  const income = await loadLatestIncome(userId);
  const pickers = await loadPickers(userId, periodStart(income));

  return (
    <Screen>
      <CloseHeader title="Новая трата" closeHref={backHref} />
      <ExpenseForm
        {...pickers}
        initial={null}
        initialMode={backHref.startsWith("/daily") ? "daily" : "envelope"}
        backHref={backHref}
        today={todayIso()}
      />
    </Screen>
  );
}
