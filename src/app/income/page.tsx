import { Screen, ScreenTitle } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { loadPayDays, loadWallets, toAllocationInput } from "@/server/queries";
import { todayIso } from "@/server/today";
import { IncomeForm } from "./income-form";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const userId = await requireUserId();
  const [wallets, payDays] = await Promise.all([
    loadWallets(userId),
    loadPayDays(userId),
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
    </Screen>
  );
}
