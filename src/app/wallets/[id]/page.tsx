import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen, ScreenHeader, Spacer } from "@/components/screen";
import { AddLink, Card } from "@/components/ui-kit";
import { formatMoney } from "@/domain/money";
import { requireUserId } from "@/server/auth/current-user";
import { isDesktop } from "@/server/device";
import { isUuid, loadWallets, toAllocationInput } from "@/server/queries";
import { EnvelopePriorities } from "./envelope-priorities";
import { WalletDesktop } from "./wallet-desktop";

export const dynamic = "force-dynamic";

export default async function WalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ envelope?: string | string[] }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const wallets = await loadWallets(userId);
  const wallet = wallets.find((w) => w.id === id);
  if (!wallet) notFound();

  if (await isDesktop()) {
    const envelope = (await searchParams).envelope;
    const selected =
      envelope === "new" ||
      (isUuid(envelope) && wallet.envelopes.some((e) => e.id === envelope))
        ? envelope
        : null;
    return <WalletDesktop wallet={wallet} selected={selected} />;
  }

  const { envelopes } = toAllocationInput([wallet]);

  return (
    <Screen>
      <ScreenHeader
        backHref="/"
        backLabel="Назад к конвертам"
        caption="Кошелёк"
        title={wallet.name}
        action={
          <Link
            href={`/wallets/${wallet.id}/edit`}
            className="shrink-0 text-sm font-semibold"
          >
            Изменить
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-1 px-4 py-3.5">
          <div className="text-sm text-ink-muted">Откладывать в месяц</div>
          <div className="font-display text-xl font-medium">
            {formatMoney(wallet.contributions)}
          </div>
        </Card>
        <Card className="flex flex-col gap-1 px-4 py-3.5">
          <div className="text-sm text-ink-muted">Сейчас в кошельке</div>
          <div className="font-display text-xl font-medium">
            {formatMoney(wallet.total)}
          </div>
        </Card>
      </div>

      {wallet.envelopes.length > 0 ? (
        <EnvelopePriorities
          walletId={wallet.id}
          envelopes={envelopes}
          statuses={Object.fromEntries(
            wallet.envelopes.map((e) => [
              e.id,
              {
                status: e.status,
                times: e.times,
                contribution: e.contribution,
                ceiling: e.ceiling,
              },
            ]),
          )}
        />
      ) : (
        <Card className="p-4 text-[15px] text-ink-muted">
          В кошельке пока нет конвертов.
        </Card>
      )}

      <Spacer />
      <AddLink href={`/envelopes/new?wallet=${wallet.id}`}>
        Добавить конверт
      </AddLink>
    </Screen>
  );
}
