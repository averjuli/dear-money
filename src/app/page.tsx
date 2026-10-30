import Link from "next/link";
import { ArrowUpIcon, ChevronIcon } from "@/components/icons";
import { BottomNav, Screen, Spacer } from "@/components/screen";
import { Bar, Card, SectionTitle } from "@/components/ui-kit";
import { categoryStatus, dailySummary } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { countEnvelopes, monthName, plural } from "@/lib/text";
import { cn } from "@/lib/utils";
import { requireUserId } from "@/server/auth/current-user";
import {
  loadCategories,
  loadDailySpent,
  loadLatestIncome,
  loadWallets,
  periodStart,
} from "@/server/queries";
import { todayIso } from "@/server/today";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await requireUserId();
  const today = todayIso();
  const income = await loadLatestIncome(userId);
  const since = periodStart(income);
  const [wallets, categories, dailySpent] = await Promise.all([
    loadWallets(userId),
    loadCategories(userId, since),
    loadDailySpent(userId, since),
  ]);

  const total = wallets.reduce((s, w) => s + w.total, 0);
  const contributions = wallets.reduce((s, w) => s + w.contributions, 0);
  const minus = wallets.reduce((s, w) => s + w.minusCount, 0);
  const daily = income
    ? dailySummary({
        budget: income.toDaily,
        spent: dailySpent,
        today,
        nextIncomeDate: income.nextIncomeDate,
      })
    : null;
  const overLimit = categories.flatMap((c) => {
    const status = categoryStatus(c.monthlyLimit, c.spent);
    return status.kind === "over" ? [{ name: c.name, over: status.over }] : [];
  });

  return (
    <Screen>
      <header className="flex items-center justify-between">
        <div className="font-display text-[22px] font-semibold text-accent">
          dear money
        </div>
        <div className="text-sm text-ink-muted">{monthName(today)}</div>
      </header>

      <section className="flex flex-col gap-3 rounded-[20px] bg-accent p-[18px] text-white">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] text-accent-soft">Всего в конвертах</div>
          <div
            data-testid="total-in-envelopes"
            className="font-display text-[32px] font-semibold leading-tight"
          >
            {formatMoney(total)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[13px]">
          <div className="rounded-full bg-accent-strong px-2.5 py-[5px]">
            Откладывать {formatMoney(contributions)} в месяц
          </div>
          {minus > 0 && (
            <div className="rounded-full bg-accent-strong px-2.5 py-[5px]">
              {minus} {plural(minus, ["конверт", "конверта", "конвертов"])} в
              минусе
            </div>
          )}
        </div>
      </section>

      <Link
        href="/income"
        className="flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-ink no-underline"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
          <ArrowUpIcon />
        </div>
        <div className="flex grow flex-col gap-0.5">
          <div className="text-base font-semibold">Пришли деньги?</div>
          <div className="text-sm text-ink-muted">
            Разложу зарплату по конвертам
          </div>
        </div>
        <ChevronIcon className="text-ink-muted" />
      </Link>

      <Link
        href="/daily"
        className="flex flex-col gap-2.5 rounded-[20px] bg-surface px-4 py-3.5 text-ink no-underline"
      >
        <div className="flex items-baseline justify-between">
          <div className="text-base font-semibold">На жизнь осталось</div>
          <div
            data-testid="daily-remaining"
            className="text-base font-semibold"
          >
            {daily ? formatMoney(daily.remaining) : "—"}
          </div>
        </div>
        {daily ? (
          <Bar
            share={daily.budget > 0 ? daily.spent / daily.budget : 0}
            tone={daily.remaining < 0 ? "warn" : "accent"}
          />
        ) : (
          <div className="text-sm text-ink-muted">
            Появится после первой раскладки зарплаты
          </div>
        )}
        {overLimit.map((c) => (
          <div key={c.name} className="text-[13px] font-medium text-warn">
            {c.name} превышен на {formatMoney(c.over)}
          </div>
        ))}
      </Link>

      <SectionTitle
        hint={
          <Link href="/wallets" className="text-sm font-semibold">
            Настроить
          </Link>
        }
      >
        Кошельки
      </SectionTitle>

      {wallets.length === 0 ? (
        <Card className="p-4 text-[15px] text-ink-muted">
          Кошельков пока нет.{" "}
          <Link href="/wallets/new" className="font-semibold">
            Создать первый
          </Link>
        </Card>
      ) : (
        <Card className="flex flex-col px-4">
          {wallets.map((w) => (
            <Link
              key={w.id}
              href={`/wallets/${w.id}`}
              className="flex min-h-[62px] items-center gap-2.5 border-b border-line text-ink no-underline last:border-b-0"
            >
              <div className="flex grow flex-col gap-0.5">
                <div className="text-base font-semibold">{w.name}</div>
                <div
                  className={cn(
                    "text-[13px]",
                    w.minusCount > 0
                      ? "font-medium text-warn"
                      : "text-ink-muted",
                  )}
                >
                  {countEnvelopes(w.envelopes.length)}
                  {w.minusCount > 0 && ` · ${w.minusCount} в минусе`}
                </div>
              </div>
              <div className="text-base font-semibold">
                {formatMoney(w.total)}
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Spacer />
      <BottomNav active="envelopes" />
    </Screen>
  );
}
