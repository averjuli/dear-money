"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Spacer } from "@/components/screen";
import { Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import { countEnvelopes } from "@/lib/text";
import { deleteWallet, saveWallet } from "@/server/actions";

export function WalletForm({
  wallet,
}: {
  wallet: {
    id: string;
    name: string;
    envelopeCount: number;
    expenseCount: number;
  } | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(wallet?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveWallet({ id: wallet?.id, name });
    if (result.ok) {
      router.push(`/wallets/${result.id}`);
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-2 p-4">
        <label htmlFor="wallet-name" className="text-[15px] font-semibold">
          Название
        </label>
        <input
          id="wallet-name"
          type="text"
          autoFocus={!wallet}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-[52px] rounded-[14px] bg-surface-sunken px-3.5 text-[17px] font-medium text-ink outline-none"
        />
      </Card>
      {error && <Notice tone="warn" title={error} />}
      <Spacer />
      <button
        type="button"
        disabled={saving || name.trim() === ""}
        onClick={save}
        className={primaryButtonClass}
      >
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
      {wallet && (
        <ConfirmButton
          label="Удалить кошелёк"
          title={`Удалить кошелёк «${wallet.name}»?`}
          description={
            wallet.envelopeCount > 0
              ? `Вместе с ним удалятся ${countEnvelopes(wallet.envelopeCount)}${
                  wallet.expenseCount > 0
                    ? ` и траты из них (${wallet.expenseCount})`
                    : ""
                }.`
              : "Кошелёк пустой."
          }
          onConfirm={async () => {
            const result = await deleteWallet(wallet.id);
            if (result.ok) {
              router.push("/");
              router.refresh();
            } else {
              setError(result.error);
            }
          }}
        />
      )}
    </>
  );
}
