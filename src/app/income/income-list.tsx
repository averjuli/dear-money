import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatMoney } from "@/domain/money";
import { formatRelativeDay, incomeKindLabel } from "@/lib/text";
import type { IncomeRow } from "@/server/queries";

/**
 * Incomes, newest first: the kind, when, the amount and under them how it was
 * split. A row opens the income. `backHref` is the screen the list stands on:
 * where «назад» of the income leads.
 */
export function IncomeList({
  incomes,
  backHref,
  today,
  title,
  moreHref,
}: {
  incomes: IncomeRow[];
  backHref: string;
  today: string;
  /** A heading above the card; none on the screen that is the list itself. */
  title?: string;
  /** Where «Все доходы» leads; no link when empty. */
  moreHref?: string;
}) {
  if (incomes.length === 0) return null;
  return (
    <section data-testid="income-history" className="flex flex-col gap-3.5">
      {title && <SectionTitle>{title}</SectionTitle>}
      <Card className="flex flex-col px-4">
        {incomes.map((income) => (
          <Link
            key={income.id}
            data-testid="income-row"
            href={`/income/${income.id}?from=${encodeURIComponent(backHref)}`}
            className="flex min-h-[64px] items-center gap-3 border-b border-line py-2 text-[15px] text-ink no-underline last:border-b-0"
          >
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <div>{incomeKindLabel(income.kind)}</div>
              <div className="text-[13px] text-ink-muted">
                {formatRelativeDay(income.date, today)}
              </div>
              <div className="text-[13px] text-ink-muted">
                в конверты {formatMoney(income.toEnvelopes)} · на жизнь{" "}
                {formatMoney(income.toDaily)}
              </div>
            </div>
            <div className="font-semibold">{formatMoney(income.amount)}</div>
          </Link>
        ))}
      </Card>
      {moreHref && (
        <Link
          href={moreHref}
          className="flex min-h-11 items-center justify-center text-base font-medium text-accent no-underline"
        >
          Все доходы
        </Link>
      )}
    </section>
  );
}
