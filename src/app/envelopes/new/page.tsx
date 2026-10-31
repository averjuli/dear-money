import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { isUuid, loadWallets } from "@/server/queries";
import { EnvelopeForm } from "../envelope-form";
import { envelopeFormProps } from "../envelope-form-props";

export const dynamic = "force-dynamic";

export default async function NewEnvelopePage({
  searchParams,
}: {
  searchParams: Promise<{ wallet?: string }>;
}) {
  const userId = await requireUserId();
  const walletId = (await searchParams).wallet;
  if (!isUuid(walletId)) notFound();
  const wallet = (await loadWallets(userId)).find((w) => w.id === walletId);
  if (!wallet) notFound();

  return (
    <Screen>
      <ScreenHeader
        backHref={`/wallets/${wallet.id}`}
        backLabel={`Назад к кошельку ${wallet.name}`}
        caption={`${wallet.name} · конверт`}
        title="Новый конверт"
      />
      <EnvelopeForm {...envelopeFormProps(wallet, null)!} />
    </Screen>
  );
}
