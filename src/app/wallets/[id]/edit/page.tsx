import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { isUuid, loadWallets } from "@/server/queries";
import { WalletForm } from "../../wallet-form";

export const dynamic = "force-dynamic";

export default async function EditWalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const wallet = (await loadWallets(userId)).find((w) => w.id === id);
  if (!wallet) notFound();

  return (
    <Screen>
      <ScreenHeader
        backHref={`/wallets/${wallet.id}`}
        backLabel={`Назад к кошельку ${wallet.name}`}
        caption="Кошелёк"
        title={wallet.name}
      />
      <WalletForm
        wallet={{
          id: wallet.id,
          name: wallet.name,
          envelopeCount: wallet.envelopes.length,
          expenseCount: wallet.envelopes.reduce(
            (s, e) => s + e.expenseCount,
            0,
          ),
        }}
      />
    </Screen>
  );
}
