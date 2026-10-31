import Link from "next/link";
import { CategoryProgress } from "@/components/category-progress";
import { DesktopScreen, Panel, PanelTitle } from "@/components/desktop";
import { ChevronIcon } from "@/components/icons";
import { Bar } from "@/components/ui-kit";
import type { DailySummary } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { formatDay, formatRelativeDay } from "@/lib/text";
import type { CategoryView, ExpenseView, IncomeView } from "@/server/queries";
import { ExpenseForm } from "../expenses/expense-form";
import type { loadPickers } from "../expenses/load-pickers";

export function DailyDesktop({
  month,
  today,
  income,
  summary,
  categories,
  recent,
  pickers,
}: {
  month: string;
  today: string;
  income: IncomeView | null;
  summary: DailySummary | null;
  categories: CategoryView[];
  recent: ExpenseView[];
  pickers: Awaited<ReturnType<typeof loadPickers>>;
}) {
  return (
    <DesktopScreen caption={month} title="Повседневные траты">
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {summary && income ? (
            <section className="flex flex-col gap-3 rounded-[20px] bg-accent px-6 py-[22px] text-white">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-[15px] text-accent-soft">
                    Осталось на жизнь
                    {income.nextIncomeDate &&
                      ` до ${formatDay(income.nextIncomeDate, today)}`}
                  </div>
                  <div
                    data-testid="daily-left"
                    className="font-display text-4xl font-semibold leading-tight"
                  >
                    {formatMoney(summary.remaining)}
                  </div>
                </div>
                {summary.perDay !== null && (
                  <div className="text-base font-semibold">
                    ≈ {formatMoney(summary.perDay)} в день
                  </div>
                )}
              </div>
              <Bar
                share={summary.budget > 0 ? summary.spent / summary.budget : 0}
                tone="white"
                track="accent-strong"
                label={`Потрачено ${formatMoney(summary.spent)} из ${formatMoney(summary.budget)}`}
              />
              <div className="text-sm text-accent-soft">
                потрачено {formatMoney(summary.spent)} из{" "}
                {formatMoney(summary.budget)} · траты из конвертов сюда не
                входят
              </div>
            </section>
          ) : (
            <Link
              href="/income"
              className="flex items-center gap-3 rounded-[20px] bg-accent px-6 py-[22px] text-white no-underline"
            >
              <div className="flex grow flex-col gap-1">
                <div className="text-base font-semibold">
                  Сначала разложите деньги
                </div>
                <div className="text-sm text-accent-soft">
                  Бюджет на жизнь появится, когда разложите зарплату по
                  конвертам
                </div>
              </div>
              <ChevronIcon />
            </Link>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-5">
            <Panel>
              <PanelTitle
                aside={
                  <Link
                    href="/daily/categories/new"
                    className="text-sm font-semibold"
                  >
                    Добавить категорию
                  </Link>
                }
              >
                По категориям
              </PanelTitle>
              {categories.length === 0 ? (
                <div className="text-sm text-ink-muted">
                  Категорий пока нет. Лимит у категории необязателен.
                </div>
              ) : (
                <div className="flex flex-col">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/daily/categories/${c.id}`}
                      className="border-t border-line py-3 text-ink no-underline"
                    >
                      <CategoryProgress
                        name={c.name}
                        limit={c.monthlyLimit}
                        spent={c.spent}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelTitle>Последние</PanelTitle>
              {recent.length === 0 ? (
                <div className="text-sm text-ink-muted">Трат пока нет</div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[300px] text-[15px] tabular-nums">
                    <div className="grid grid-cols-[64px_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-x-2 px-1 py-2.5 text-[13px] font-medium text-ink-muted">
                      <div>Когда</div>
                      <div>Категория</div>
                      <div>Заметка</div>
                      <div className="text-right">Сумма</div>
                    </div>
                    {recent.map((e) => (
                      <Link
                        key={e.id}
                        href={`/expenses/${e.id}?from=/daily`}
                        className="grid min-h-12 grid-cols-[64px_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-2 border-t border-line px-1 text-ink no-underline"
                      >
                        <div className="whitespace-nowrap text-ink-muted">
                          {formatRelativeDay(e.date, today)}
                        </div>
                        <div className="truncate font-semibold">
                          {e.targetName}
                        </div>
                        <div className="truncate text-ink-muted">
                          {e.note ?? ""}
                        </div>
                        <div className="whitespace-nowrap text-right font-semibold">
                          {formatMoney(e.amount)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        <div className="min-w-0 max-w-[400px] flex-[1_1_320px]">
          <Panel>
            <h2 className="m-0 text-lg font-semibold">Новая трата</h2>
            <ExpenseForm
              {...pickers}
              initial={null}
              initialMode="daily"
              backHref="/daily"
              today={today}
              variant="panel"
              dailyRemaining={summary?.remaining ?? null}
            />
          </Panel>
        </div>
      </div>
    </DesktopScreen>
  );
}
