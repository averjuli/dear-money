import { Screen, ScreenTitle } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { loadWallets, toAllocationInput } from "@/server/queries";
import { todayIso } from "@/server/today";
import { IncomeForm } from "./income-form";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const userId = await requireUserId();
  const input = toAllocationInput(await loadWallets(userId));

  return (
    <Screen>
      <ScreenTitle>Пришли деньги</ScreenTitle>
      <IncomeForm
        wallets={input.wallets}
        envelopes={input.envelopes}
        today={todayIso()}
      />
    </Screen>
  );
}
