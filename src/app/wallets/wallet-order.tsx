"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SortableList } from "@/components/sortable-list";
import { Notice } from "@/components/ui-kit";
import { countEnvelopes } from "@/lib/text";
import { reorderWallets } from "@/server/actions";

interface WalletRow {
  id: string;
  name: string;
  envelopeCount: number;
}

export function WalletOrder({ wallets }: { wallets: WalletRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(wallets);
  const [error, setError] = useState<string | null>(null);

  async function reorder(next: WalletRow[]) {
    const previous = items;
    setItems(next);
    setError(null);
    const result = await reorderWallets(next.map((w) => w.id));
    if (result.ok) router.refresh();
    else {
      setItems(previous);
      setError(result.error);
    }
  }

  if (items.length === 0) return null;
  return (
    <>
      {error && <Notice tone="warn" title={error} />}
      <div className="rounded-[20px] bg-surface pl-4 pr-1">
        <SortableList
          items={items}
          onReorder={reorder}
          handleLabel={(w) => `Перетащить «${w.name}»`}
          renderRow={(w) => (
            <Link
              href={`/wallets/${w.id}`}
              className="flex min-h-[62px] grow flex-col justify-center gap-0.5 text-ink no-underline"
            >
              <div className="text-base font-semibold">{w.name}</div>
              <div className="text-[13px] text-ink-muted">
                {countEnvelopes(w.envelopeCount)}
              </div>
            </Link>
          )}
        />
      </div>
    </>
  );
}
