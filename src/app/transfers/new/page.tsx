import { CloseHeader, Screen } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { loadDailySummary } from "@/server/queries";
import { todayIso } from "@/server/today";
import { safeBackHref } from "../../expenses/load-pickers";
import { loadTransferWallets } from "../load-wallets";
import { TransferForm } from "../transfer-form";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const params = await searchParams;
  const backHref = safeBackHref(params.from);
  const today = todayIso();
  const [wallets, daily] = await Promise.all([
    loadTransferWallets(userId),
    loadDailySummary(userId, today),
  ]);
  const dailyRemaining = daily?.summary.remaining ?? null;
  const to = Array.isArray(params.to) ? params.to[0] : params.to;

  return (
    <Screen>
      <CloseHeader title="Перевод" closeHref={backHref} />
      <TransferForm
        wallets={wallets}
        dailyRemaining={dailyRemaining}
        initial={null}
        startTo={to === "daily" && dailyRemaining !== null ? "daily" : null}
        backHref={backHref}
        today={today}
      />
    </Screen>
  );
}
