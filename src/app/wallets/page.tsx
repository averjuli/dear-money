import Link from "next/link";
import { Screen, ScreenHeader, Spacer } from "@/components/screen";
import { AddLink, SectionTitle } from "@/components/ui-kit";
import { logout } from "@/server/actions";
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
      <Spacer />
      <Link href="/install" className="text-center text-sm font-semibold">
        Как установить на iPhone
      </Link>
      <form action={logout} className="flex justify-center">
        <button
          type="submit"
          className="min-h-11 bg-transparent text-sm font-medium text-ink-muted"
        >
          Выйти
        </button>
      </form>
    </Screen>
  );
}
