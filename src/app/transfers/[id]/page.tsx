import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { isUuid, loadDailySummary, loadTransfer } from "@/server/queries";
import { todayIso } from "@/server/today";
import { safeBackHref } from "../../expenses/load-pickers";
import { loadTransferWallets } from "../load-wallets";
import { TransferForm } from "../transfer-form";

export const dynamic = "force-dynamic";

export default async function EditTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const transfer = await loadTransfer(userId, id);
  if (!transfer) notFound();

  const today = todayIso();
  const [wallets, daily] = await Promise.all([
    loadTransferWallets(userId),
    loadDailySummary(userId, today),
  ]);

  // Back to the screen the transfer was opened from; else to a side it touches.
  const envelopeSide = [transfer.from, transfer.to].find(
    (side) => side.kind === "envelope",
  );
  const fallback =
    transfer.from.kind === "daily" || transfer.to.kind === "daily"
      ? "/daily"
      : envelopeSide?.kind === "envelope"
        ? `/envelopes/${envelopeSide.envelopeId}`
        : "/";
  const backHref = safeBackHref((await searchParams).from ?? fallback);

  return (
    <Screen>
      <ScreenHeader backHref={backHref} backLabel="Назад" title="Перевод" />
      <TransferForm
        wallets={wallets}
        dailyRemaining={daily?.summary.remaining ?? null}
        initial={{
          id: transfer.id,
          amount: transfer.amount,
          date: transfer.date,
          from: transfer.from,
          to: transfer.to,
          journaled: transfer.journaled,
        }}
        backHref={backHref}
        today={today}
      />
    </Screen>
  );
}
