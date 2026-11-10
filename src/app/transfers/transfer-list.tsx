import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatMoney } from "@/domain/money";
import { signedAmount, type TransferSide } from "@/domain/transfer";
import { formatRelativeDay, transferLabel } from "@/lib/text";
import type { TransferView } from "@/server/queries";

/**
 * «Переводы»: transfers of one side (an envelope or «на жизнь»), newest first.
 * No transfers, no block. A row opens the transfer to edit or delete it.
 */
export function TransferList({
  transfers,
  viewpoint,
  backHref,
  today,
}: {
  transfers: TransferView[];
  viewpoint: TransferSide;
  /** The screen the list stands on: where «назад» of the transfer leads. */
  backHref: string;
  today: string;
}) {
  if (transfers.length === 0) return null;
  return (
    <section data-testid="transfers" className="flex flex-col gap-3.5">
      <SectionTitle>Переводы</SectionTitle>
      <Card className="flex flex-col px-4">
        {transfers.map((t) => {
          const signed = signedAmount(t, viewpoint);
          return (
            <Link
              key={t.id}
              href={`/transfers/${t.id}?from=${encodeURIComponent(backHref)}`}
              className="flex min-h-[52px] items-center border-b border-line text-[15px] text-ink no-underline last:border-b-0"
            >
              <div className="grow py-1.5">
                <div>{transferLabel(t, viewpoint)}</div>
                <div className="text-[13px] text-ink-muted">
                  {formatRelativeDay(t.date, today)}
                </div>
              </div>
              <div className="font-semibold">
                {signed > 0 ? "+" : ""}
                {formatMoney(signed)}
              </div>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}
