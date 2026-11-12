import { Screen, ScreenTitle } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import {
  loadIncomes,
  loadPayDays,
  loadWallets,
  toAllocationInput,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { IncomeForm } from "./income-form";
import { IncomeList } from "./income-list";

const HISTORY_SIZE = 10;

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const userId = await requireUserId();
  const [wallets, payDays, recent] = await Promise.all([
    loadWallets(userId),
    loadPayDays(userId),
    // One more than shown: tells whether there is a «Все доходы» to open.
    loadIncomes(userId, HISTORY_SIZE + 1),
  ]);
  const input = toAllocationInput(wallets);

  return (
    <Screen>
      <ScreenTitle>Пришли деньги</ScreenTitle>
      <IncomeForm
        wallets={input.wallets}
        envelopes={input.envelopes}
        advanceDay={payDays.advanceDay}
        salaryDay={payDays.salaryDay}
        today={todayIso()}
      />
      <IncomeList
        title="История"
        incomes={recent.slice(0, HISTORY_SIZE)}
        backHref="/income"
        today={todayIso()}
        moreHref={recent.length > HISTORY_SIZE ? "/income/all" : undefined}
      />
    </Screen>
  );
}
