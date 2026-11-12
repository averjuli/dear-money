import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { loadIncomes } from "@/server/queries";
import { todayIso } from "@/server/today";
import { IncomeList } from "../income-list";

export const dynamic = "force-dynamic";

export default async function AllIncomesPage() {
  const userId = await requireUserId();
  const incomes = await loadIncomes(userId);
  return (
    <Screen>
      <ScreenHeader backHref="/income" backLabel="Назад" title="Все доходы" />
      <IncomeList incomes={incomes} backHref="/income/all" today={todayIso()} />
    </Screen>
  );
}
