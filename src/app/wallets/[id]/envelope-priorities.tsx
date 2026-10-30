"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SortableList } from "@/components/sortable-list";
import { Notice, SectionTitle } from "@/components/ui-kit";
import { planWallet, type AllocationEnvelope } from "@/domain/allocation";
import type { EnvelopeStatus } from "@/domain/envelope";
import { formatMoney } from "@/domain/money";
import { countEnvelopes, countTimes, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { reorderEnvelopes } from "@/server/actions";

interface StatusInfo {
  status: EnvelopeStatus;
  times: number;
  contribution: number;
}

function statusText(info: StatusInfo, balance: number): string {
  if (info.status === "minus") return `минус ${formatMoney(-balance)}`;
  if (info.status === "full") return `накоплено на ${countTimes(info.times)}`;
  return `копится · на ${countTimes(info.times)}`;
}

export function EnvelopePriorities({
  walletId,
  envelopes,
  statuses,
}: {
  walletId: string;
  envelopes: AllocationEnvelope[];
  statuses: Record<string, StatusInfo>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(envelopes);
  const [error, setError] = useState<string | null>(null);

  // Priorities follow the current order on screen.
  const ordered = useMemo(
    () => items.map((e, i) => ({ ...e, priority: i + 1 })),
    [items],
  );
  const surplus = planWallet(ordered).surplus;
  const receiverIds = new Set(surplus?.receivers.map((r) => r.envelopeId));

  async function reorder(next: AllocationEnvelope[]) {
    const previous = items;
    setItems(next);
    setError(null);
    const result = await reorderEnvelopes(
      walletId,
      next.map((e) => e.id),
    );
    if (result.ok) {
      router.refresh();
    } else {
      setItems(previous);
      setError(result.error);
    }
  }

  return (
    <>
      {surplus && (
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-accent px-4 py-3.5 text-white">
          <div className="text-base font-semibold">
            Излишек в этом месяце: {formatMoney(surplus.amount)}
          </div>
          <div className="text-sm leading-snug text-accent-soft">
            {countEnvelopes(surplus.fullEnvelopeNames.length)} уже{" "}
            {surplus.fullEnvelopeNames.length === 1 ? "накоплен" : "накоплены"}.{" "}
            {surplus.receivers.length > 0
              ? `Их взносы уйдут в ${surplus.receivers.map((r) => quoted(r.name)).join(" и ")}: выше всех по приоритету среди неполных.`
              : "Неполных конвертов нет, поэтому взносы уйдут на повседневные траты."}
          </div>
        </div>
      )}

      <SectionTitle hint="перетащите, чтобы изменить">
        Конверты по приоритету
      </SectionTitle>
      {error && <Notice tone="warn" title={error} />}

      <div className="rounded-[20px] bg-surface pl-3.5 pr-1">
        <SortableList
          items={items}
          onReorder={reorder}
          handleLabel={(e) => `Перетащить «${e.name}»`}
          rowClassName={(e) =>
            receiverIds.has(e.id)
              ? "-ml-3.5 bg-warn-soft pl-3.5 rounded-none"
              : undefined
          }
          renderRow={(e, index) => {
            const info = statuses[e.id];
            const receiver = receiverIds.has(e.id);
            const tone = receiver
              ? "text-warn-strong"
              : info.status === "minus"
                ? "text-warn"
                : info.status === "full"
                  ? "text-accent"
                  : "text-ink-muted";
            return (
              <Link
                href={`/envelopes/${e.id}`}
                className="flex min-h-14 grow items-center gap-2.5 text-ink no-underline"
              >
                <div
                  className={cn(
                    "w-[22px] text-sm font-semibold",
                    receiver ? "text-warn-strong" : "text-ink-muted",
                  )}
                >
                  {index + 1}
                </div>
                <div className="flex grow flex-col gap-px">
                  <div
                    className={cn(
                      "text-[15px] font-semibold",
                      receiver && "text-warn-strong",
                    )}
                  >
                    {e.name}
                  </div>
                  <div className={cn("text-[13px]", tone)}>
                    {statusText(info, e.balance)}
                    {receiver && " · получит излишек"}
                  </div>
                </div>
                <div
                  className={cn(
                    "whitespace-nowrap text-sm",
                    receiver ? "text-warn-strong" : "text-ink-muted",
                  )}
                >
                  {formatMoney(info.contribution)}/мес
                </div>
              </Link>
            );
          }}
        />
      </div>
    </>
  );
}
