import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { BottomNav, Screen, ScreenTitle, Spacer } from "@/components/screen";
import { AddLink, Bar, Card, SectionTitle } from "@/components/ui-kit";
import { categoryStatus, dailySummary } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { formatDay, formatRelativeDay } from "@/lib/text";
import { cn } from "@/lib/utils";
import { requireUserId } from "@/server/auth/current-user";
import {
  loadCategories,
  loadDailySpent,
  loadExpenses,
  loadLatestIncome,
  periodStart,
} from "@/server/queries";
import { todayIso } from "@/server/today";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const userId = await requireUserId();
  const today = todayIso();
  const income = await loadLatestIncome(userId);
  const since = periodStart(income);
  const [categories, spent, recent] = await Promise.all([
    loadCategories(userId, since),
    loadDailySpent(userId, since),
    loadExpenses(userId, { kind: "daily", limit: 10 }),
  ]);
  const summary = income
    ? dailySummary({
        budget: income.toDaily,
        spent,
        today,
        nextIncomeDate: income.nextIncomeDate,
      })
    : null;

  return (
    <Screen>
      <ScreenTitle>Повседневные траты</ScreenTitle>

      {summary && income ? (
        <section className="flex flex-col gap-3 rounded-[20px] bg-accent p-[18px] text-white">
          <div className="flex flex-col gap-1">
            <div className="text-[15px] text-accent-soft">
              Осталось на жизнь
              {income.nextIncomeDate &&
                ` до ${formatDay(income.nextIncomeDate, today)}`}
            </div>
            <div
              data-testid="daily-left"
              className="font-display text-[32px] font-semibold leading-tight"
            >
              {formatMoney(summary.remaining)}
            </div>
          </div>
          <Bar
            share={summary.budget > 0 ? summary.spent / summary.budget : 0}
            tone="white"
            track="accent-strong"
            label={`Потрачено ${formatMoney(summary.spent)} из ${formatMoney(summary.budget)}`}
          />
          <div className="flex flex-wrap justify-between gap-2 text-sm text-accent-soft">
            <div>
              потрачено {formatMoney(summary.spent, { currency: false })} из{" "}
              {formatMoney(summary.budget)}
            </div>
            {summary.perDay !== null && (
              <div>≈ {formatMoney(summary.perDay)} в день</div>
            )}
          </div>
        </section>
      ) : (
        <Link
          href="/income"
          className="flex items-center gap-3 rounded-[20px] bg-accent p-[18px] text-white no-underline"
        >
          <div className="flex grow flex-col gap-1">
            <div className="text-base font-semibold">
              Сначала разложите деньги
            </div>
            <div className="text-sm text-accent-soft">
              Бюджет на жизнь появится, когда разложите зарплату по конвертам
            </div>
          </div>
          <ChevronIcon />
        </Link>
      )}

      <p className="m-0 text-sm leading-snug text-ink-muted">
        Это всё, что осталось от зарплаты после конвертов. Траты из конвертов
        сюда не входят.
      </p>

      <SectionTitle hint="лимит необязателен">По категориям</SectionTitle>
      {categories.length > 0 && (
        <Card className="flex flex-col px-4">
          {categories.map((c) => {
            const status = categoryStatus(c.monthlyLimit, c.spent);
            const rowClass =
              "border-b border-line text-ink no-underline last:border-b-0";
            if (status.kind === "none") {
              return (
                <Link
                  key={c.id}
                  href={`/daily/categories/${c.id}`}
                  className={cn("flex min-h-14 items-center gap-2.5", rowClass)}
                >
                  <div className="grow text-base font-semibold">{c.name}</div>
                  <div className="text-base font-semibold">
                    {formatMoney(c.spent)}
                  </div>
                </Link>
              );
            }
            return (
              <Link
                key={c.id}
                href={`/daily/categories/${c.id}`}
                className={cn("flex flex-col gap-[7px] py-3.5", rowClass)}
              >
                <div className="flex justify-between gap-2 text-base">
                  <div className="font-semibold">{c.name}</div>
                  <div
                    className={cn(
                      "font-semibold",
                      status.kind === "over" && "text-warn",
                    )}
                  >
                    {formatMoney(c.spent, { currency: false })} из{" "}
                    {formatMoney(c.monthlyLimit!)}
                  </div>
                </div>
                <Bar
                  share={status.share}
                  tone={status.kind === "over" ? "warn" : "accent"}
                />
                {status.kind === "over" ? (
                  <div className="text-[13px] font-medium text-warn">
                    лимит превышен на {formatMoney(status.over)}
                  </div>
                ) : (
                  <div className="text-[13px] text-ink-muted">
                    осталось {formatMoney(status.left)}
                  </div>
                )}
              </Link>
            );
          })}
        </Card>
      )}
      <AddLink href="/daily/categories/new">Добавить категорию</AddLink>

      {recent.length > 0 && (
        <>
          <SectionTitle>Последние</SectionTitle>
          <Card className="flex flex-col px-4">
            {recent.map((e) => (
              <Link
                key={e.id}
                href={`/expenses/${e.id}?from=/daily`}
                className="flex min-h-[52px] items-center border-b border-line text-[15px] text-ink no-underline last:border-b-0"
              >
                <div className="grow">
                  {e.note ? `${e.targetName}: ${e.note}` : e.targetName}{" "}
                  <span className="text-ink-muted">
                    · {formatRelativeDay(e.date, today)}
                  </span>
                </div>
                <div className="font-semibold">{formatMoney(e.amount)}</div>
              </Link>
            ))}
          </Card>
        </>
      )}

      <Spacer />
      <BottomNav active="daily" />
    </Screen>
  );
}
