import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, SectionTitle } from "@/components/ui-kit";
import { planWallet } from "@/domain/allocation";
import { formatMoney } from "@/domain/money";
import { formatRelativeDay } from "@/lib/text";
import { requireUserId } from "@/server/auth/current-user";
import {
  isUuid,
  loadExpenses,
  loadWallets,
  toAllocationInput,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { EnvelopeForm } from "../envelope-form";

export const dynamic = "force-dynamic";

export default async function EnvelopePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const wallets = await loadWallets(userId);
  const wallet = wallets.find((w) => w.envelopes.some((e) => e.id === id));
  const envelope = wallet?.envelopes.find((e) => e.id === id);
  if (!wallet || !envelope) notFound();

  const today = todayIso();
  const expenses = await loadExpenses(userId, { envelopeId: id, limit: 10 });
  const plan = planWallet(toAllocationInput([wallet]).envelopes);
  const ownItem = plan.items.find((i) => i.sourceEnvelopeId === id);
  const receivers = (ownItem?.destinations ?? [])
    .filter((d) => d.kind === "surplus" && d.envelopeId !== null)
    .map(
      (d) => wallet.envelopes.find((e) => e.id === d.envelopeId)?.name ?? "",
    );

  return (
    <Screen>
      <ScreenHeader
        backHref={`/wallets/${wallet.id}`}
        backLabel={`Назад к кошельку ${wallet.name}`}
        caption={`${wallet.name} · конверт`}
        title={envelope.name}
      />
      <EnvelopeForm
        walletId={wallet.id}
        walletName={wallet.name}
        envelope={{
          id: envelope.id,
          name: envelope.name,
          costPerTime: envelope.costPerTime,
          periodN: envelope.periodN,
          periodUnit: envelope.periodUnit,
          contributionOverride: envelope.contributionOverride,
          timesToSave: envelope.timesToSave,
          startBalance: envelope.startBalance,
          balance: envelope.balance,
          expenseCount: envelope.expenseCount,
        }}
        priority={wallet.envelopes.findIndex((e) => e.id === id) + 1}
        priorityCount={wallet.envelopes.length}
        surplusReceivers={receivers}
      />
      {expenses.length > 0 && (
        <>
          <SectionTitle>Последние траты</SectionTitle>
          <Card className="flex flex-col pl-4 pr-2">
            {expenses.map((e) => (
              <Link
                key={e.id}
                href={`/expenses/${e.id}?from=/envelopes/${envelope.id}`}
                className="flex min-h-[60px] items-center gap-2.5 border-b border-line text-ink no-underline last:border-b-0"
              >
                <div className="flex grow flex-col gap-0.5">
                  <div className="text-[15px] font-semibold">
                    {e.note ?? envelope.name}
                  </div>
                  <div className="text-[13px] text-ink-muted">
                    {formatRelativeDay(e.date, today)}
                  </div>
                </div>
                <div className="pr-2 text-[15px] font-semibold">
                  {formatMoney(e.amount)}
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
