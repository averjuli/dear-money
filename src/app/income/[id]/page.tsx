import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen, ScreenHeader, Spacer } from "@/components/screen";
import { Card, SectionTitle, primaryButtonClass } from "@/components/ui-kit";
import { incomeBreakdown, incomeDeletionEffect } from "@/domain/income";
import { formatMoney } from "@/domain/money";
import { formatRelativeDay, incomeKindLabel } from "@/lib/text";
import { requireUserId } from "@/server/auth/current-user";
import {
  isUuid,
  loadIncome,
  loadWallets,
  toAllocationInput,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { incomeBackHref } from "../back-href";
import { DeleteIncomeButton } from "./delete-income-button";

export const dynamic = "force-dynamic";

export default async function IncomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const income = await loadIncome(userId, id);
  if (!income) notFound();

  const input = toAllocationInput(await loadWallets(userId));
  const breakdown = incomeBreakdown(
    income.lines,
    input.wallets,
    input.envelopes,
    income.toEnvelopes,
  );
  const effect = incomeDeletionEffect(income, income.lines);
  const from = (await searchParams).from;
  const backHref = incomeBackHref(from);

  return (
    <Screen>
      <ScreenHeader backHref={backHref} backLabel="Назад" title="Доход" />
      <Card className="flex flex-col gap-1 p-4">
        <div className="text-[15px] font-semibold">
          {incomeKindLabel(income.kind)}
        </div>
        <div className="text-[13px] text-ink-muted">
          {formatRelativeDay(income.date, todayIso())}
        </div>
        <div className="font-display text-[32px] font-semibold leading-tight">
          {formatMoney(income.amount)}
        </div>
      </Card>

      <Card className="flex flex-col px-4">
        <div className="flex min-h-[52px] items-center border-b border-line text-base font-semibold">
          <div className="grow">В конверты</div>
          <div data-testid="income-to-envelopes">
            {formatMoney(income.toEnvelopes)}
          </div>
        </div>
        <div className="flex min-h-[52px] items-center text-base font-semibold">
          <div className="grow">На повседневные траты</div>
          <div data-testid="income-to-daily">{formatMoney(income.toDaily)}</div>
        </div>
      </Card>

      {(breakdown.wallets.length > 0 || breakdown.toDeleted > 0) && (
        <SectionTitle>Раскладка</SectionTitle>
      )}
      {breakdown.wallets.map((wallet) => (
        <div key={wallet.walletId} data-testid="income-wallet">
          <Card className="flex flex-col px-4 py-1">
            <div className="flex min-h-11 items-center text-base font-semibold">
              <div className="grow">{wallet.name}</div>
              <div>{formatMoney(wallet.amount)}</div>
            </div>
            {wallet.envelopes.map((envelope) => (
              <div
                key={envelope.envelopeId}
                className="flex min-h-11 items-center gap-3 border-t border-line py-1.5 text-[15px]"
              >
                <div className="flex min-w-0 grow flex-col">
                  <div>{envelope.name}</div>
                  {envelope.surplus > 0 && (
                    <div className="text-[13px] text-ink-muted">
                      взнос {formatMoney(envelope.contribution)} + излишек{" "}
                      {formatMoney(envelope.surplus)}
                    </div>
                  )}
                </div>
                <div className="font-semibold">
                  {formatMoney(envelope.amount)}
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}
      {breakdown.toDeleted > 0 && (
        <Card className="flex min-h-[52px] items-center px-4 text-[15px]">
          <div className="grow">В удалённые конверты</div>
          <div className="font-semibold">
            {formatMoney(breakdown.toDeleted)}
          </div>
        </Card>
      )}

      <Spacer />
      <Link
        href={`/income/${income.id}/edit?from=${encodeURIComponent(backHref)}`}
        className={primaryButtonClass}
      >
        Изменить
      </Link>
      <DeleteIncomeButton
        id={income.id}
        backHref={backHref}
        description={
          <>
            Из конвертов уйдёт {formatMoney(effect.fromEnvelopes)}, из денег на
            жизнь {formatMoney(effect.fromDaily)}.
            {income.nextCount > 0 && (
              <> Следующие раскладки пересчитаются: {income.nextCount}.</>
            )}{" "}
            Траты и переводы останутся.
          </>
        }
      />
    </Screen>
  );
}
