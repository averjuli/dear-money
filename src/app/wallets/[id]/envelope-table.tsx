"use client";

import Link from "next/link";
import { Panel, PanelTitle } from "@/components/desktop";
import { SortableList } from "@/components/sortable-list";
import { Notice } from "@/components/ui-kit";
import type { AllocationEnvelope } from "@/domain/allocation";
import { formatMoney } from "@/domain/money";
import { countTimes } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  SurplusBanner,
  useEnvelopeOrder,
  type StatusInfo,
} from "./envelope-priorities";

// Same columns for the header and every row; the drag handle sits after them.
const COLUMNS =
  "grid grow grid-cols-[28px_minmax(110px,1.3fr)_minmax(150px,1.7fr)_100px_minmax(84px,1fr)_minmax(84px,1fr)_minmax(80px,0.9fr)] items-center gap-x-2.5";

function statusLine(info: StatusInfo, receiver: boolean) {
  if (receiver) {
    return {
      text: `${info.status === "minus" ? "минус" : "копится"} · получит излишек`,
      tone: "font-medium text-warn-strong",
    };
  }
  if (info.status === "minus")
    return { text: "минус", tone: "font-medium text-warn" };
  if (info.status === "full") {
    return {
      text: `полный · на ${countTimes(info.times)}`,
      tone: "font-medium text-accent",
    };
  }
  return {
    text: `копится · на ${countTimes(info.times)}`,
    tone: "text-ink-muted",
  };
}

/** Desktop wallet: surplus, envelopes by priority as a table, settings panel on the right. */
export function EnvelopeTable({
  walletId,
  envelopes,
  statuses,
  selectedId,
  aside,
}: {
  walletId: string;
  envelopes: AllocationEnvelope[];
  statuses: Record<string, StatusInfo>;
  selectedId: string | null;
  aside: React.ReactNode;
}) {
  const { items, reorder, error, surplus, receiverIds } = useEnvelopeOrder(
    walletId,
    envelopes,
  );

  return (
    <>
      {surplus && (
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-accent px-[22px] py-4 text-white">
          <SurplusBanner surplus={surplus} />
        </div>
      )}
      {error && <Notice tone="warn" title={error} />}

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_640px]">
          <Panel>
            <PanelTitle
              aside={
                <span className="text-[13px] text-ink-muted">
                  перетащите строку, чтобы изменить
                </span>
              }
            >
              Конверты по приоритету
            </PanelTitle>
            {items.length === 0 ? (
              <div className="text-[15px] text-ink-muted">
                В кошельке пока нет конвертов.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[700px] text-[15px] tabular-nums">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        COLUMNS,
                        "py-2.5 pl-2.5 text-[13px] font-medium text-ink-muted",
                      )}
                    >
                      <div>#</div>
                      <div>Конверт</div>
                      <div>Статус</div>
                      <div>Заполнен</div>
                      <div className="text-right">Остаток</div>
                      <div className="text-right">Потолок</div>
                      <div className="text-right">Взнос/мес</div>
                    </div>
                    <div className="w-11 shrink-0" />
                  </div>
                  <div className="border-t border-line">
                    <SortableList
                      items={items}
                      onReorder={reorder}
                      handleLabel={(e) => `Перетащить «${e.name}»`}
                      rowClassName={(e) =>
                        receiverIds.has(e.id)
                          ? "bg-warn-soft"
                          : e.id === selectedId
                            ? "bg-accent-soft"
                            : undefined
                      }
                      renderRow={(e, index) => {
                        const info = statuses[e.id];
                        const status = statusLine(info, receiverIds.has(e.id));
                        const fill =
                          info.ceiling > 0
                            ? Math.min(Math.max(e.balance / info.ceiling, 0), 1)
                            : 0;
                        return (
                          <Link
                            href={`/wallets/${walletId}?envelope=${e.id}`}
                            scroll={false}
                            aria-current={
                              e.id === selectedId ? "true" : undefined
                            }
                            className={cn(
                              COLUMNS,
                              "min-h-12 py-2 pl-2.5 text-ink no-underline",
                            )}
                          >
                            <div className="font-semibold text-ink-muted">
                              {index + 1}
                            </div>
                            <div className="font-semibold">{e.name}</div>
                            <div className={cn("text-sm", status.tone)}>
                              {status.text}
                            </div>
                            <div
                              role="img"
                              aria-label={`Заполнен на ${Math.round(fill * 100)}%`}
                              className="h-1.5 rounded-[3px] bg-line"
                            >
                              <div
                                className={cn(
                                  "h-1.5 rounded-[3px]",
                                  info.status === "full"
                                    ? "bg-accent"
                                    : "bg-dash",
                                )}
                                style={{ width: `${Math.round(fill * 100)}%` }}
                              />
                            </div>
                            <div
                              className={cn(
                                "whitespace-nowrap text-right font-semibold",
                                e.balance < 0 && "text-warn",
                              )}
                            >
                              {formatMoney(e.balance)}
                            </div>
                            <div className="whitespace-nowrap text-right text-ink-muted">
                              {formatMoney(info.ceiling)}
                            </div>
                            <div className="whitespace-nowrap text-right">
                              {formatMoney(info.contribution)}
                            </div>
                          </Link>
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            <Link
              href={`/wallets/${walletId}?envelope=new`}
              scroll={false}
              className="inline-flex min-h-11 items-center self-start rounded-[14px] border-2 border-dashed border-dash px-[18px] text-[15px] font-medium text-ink no-underline"
            >
              Добавить конверт
            </Link>
          </Panel>
        </div>
        {aside}
      </div>
    </>
  );
}
