import { Screen, ScreenHeader } from "@/components/screen";
import { AddLink, SectionTitle } from "@/components/ui-kit";
import { requireUserId } from "@/server/auth/current-user";
import { loadWallets } from "@/server/queries";
import { WalletOrder } from "./wallet-order";

export const dynamic = "force-dynamic";

export default async function WalletsPage() {
  const userId = await requireUserId();
  const wallets = await loadWallets(userId);
  return (
    <Screen>
      <ScreenHeader
        backHref="/"
        backLabel="Назад к конвертам"
        title="Кошельки"
      />
      <SectionTitle hint="перетащите, чтобы изменить">
        Порядок на главной
      </SectionTitle>
      <WalletOrder
        wallets={wallets.map((w) => ({
          id: w.id,
          name: w.name,
          envelopeCount: w.envelopes.length,
        }))}
      />
      <AddLink href="/wallets/new">Добавить кошелёк</AddLink>
    </Screen>
  );
}
