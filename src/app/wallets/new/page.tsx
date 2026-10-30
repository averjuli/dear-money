import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { WalletForm } from "../wallet-form";

export const dynamic = "force-dynamic";

export default async function NewWalletPage() {
  await requireUserId();
  return (
    <Screen>
      <ScreenHeader
        backHref="/wallets"
        backLabel="Назад к кошелькам"
        title="Новый кошелёк"
      />
      <WalletForm wallet={null} />
    </Screen>
  );
}
