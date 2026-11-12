import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { isUuid, loadIncomeEditInput } from "@/server/queries";
import { incomeBackHref } from "../../back-href";
import { IncomeForm } from "../../income-form";

export const dynamic = "force-dynamic";

export default async function EditIncomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const input = await loadIncomeEditInput(userId, id);
  if (!input) notFound();

  // «Назад» and «Сохранить» lead to the income screen, which remembers where it was opened from.
  const incomeHref = `/income/${id}?from=${encodeURIComponent(
    incomeBackHref((await searchParams).from),
  )}`;

  return (
    <Screen>
      <ScreenHeader backHref={incomeHref} backLabel="Назад" title="Доход" />
      <IncomeForm
        wallets={input.wallets}
        envelopes={input.envelopes}
        correction={{
          id,
          amount: input.amount,
          kind: input.kind,
          skippedWalletIds: input.skippedWalletIds,
          toDeleted: input.toDeleted,
          nextCount: input.nextCount,
          doneHref: incomeHref,
        }}
      />
    </Screen>
  );
}
