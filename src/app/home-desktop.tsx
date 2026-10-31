import Link from "next/link";
import { CategoryProgress } from "@/components/category-progress";
import { DesktopScreen, Panel, PanelTitle } from "@/components/desktop";
import { ArrowUpIcon, PlusIcon } from "@/components/icons";
import { Bar } from "@/components/ui-kit";
import type { DailySummary } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { mainEnvelopes } from "@/domain/priority";
import { countEnvelopes, countTimes, formatDay, plural } from "@/lib/text";
import { cn } from "@/lib/utils";
import type {
  CategoryView,
  EnvelopeView,
  IncomeView,
  WalletView,
} from "@/server/queries";

function shortStatus(e: EnvelopeView): string {
  if (e.status === "minus") return "минус";
  if (e.status === "full") return `на ${countTimes(e.times)}`;
  return "копится";
}

function WalletCard({ wallet }: { wallet: WalletView }) {
  const { shown, more } = mainEnvelopes(wallet.envelopes);
  return (
    <Link
      href={`/wallets/${wallet.id}`}
      className="flex min-w-0 flex-col gap-2.5 rounded-[20px] bg-surface px-5 py-[18px] text-ink no-underline"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[17px] font-semibold">{wallet.name}</div>
        {wallet.minusCount > 0 ? (
          <div className="whitespace-nowrap text-[13px] font-medium text-warn">
            {wallet.minusCount} в минусе
          </div>
        ) : (
          <div className="whitespace-nowrap text-[13px] text-ink-muted">
            {wallet.envelopes.length} конв.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-display text-[22px] font-medium">
          {formatMoney(wallet.total)}
        </div>
        <div className="text-[13px] text-ink-muted">
          +{formatMoney(wallet.contributions)} в месяц
        </div>
      </div>
      {shown.length > 0 ? (
        <div className="flex flex-col border-t border-line pt-1.5">
          {shown.map((e) => (
            <div
              key={e.id}
              className={cn(
                "flex min-h-[34px] items-center gap-2.5 text-sm",
                e.status === "minus" && "text-warn",
              )}
            >
              <div className="min-w-0 grow truncate">{e.name}</div>
              <div
                className={cn(
                  "shrink-0 whitespace-nowrap text-[13px]",
                  e.status === "minus" ? "text-warn" : "text-ink-muted",
                )}
              >
                {shortStatus(e)}
              </div>
              <div className="min-w-[76px] shrink-0 whitespace-nowrap text-right font-semibold">
                {formatMoney(e.balance)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-line pt-2.5 text-sm text-ink-muted">
          Конвертов пока нет
        </div>
      )}
      {more > 0 && <div className="text-[13px] text-ink-muted">ещё {more}</div>}
    </Link>
  );
}

export function HomeDesktop({
  month,
  today,
  wallets,
  categories,
  income,
  daily,
}: {
  month: string;
  today: string;
  wallets: WalletView[];
  categories: CategoryView[];
  income: IncomeView | null;
  daily: DailySummary | null;
}) {
  const total = wallets.reduce((s, w) => s + w.total, 0);
  const contributions = wallets.reduce((s, w) => s + w.contributions, 0);
  const minus = wallets.reduce((s, w) => s + w.minusCount, 0);
  const envelopeCount = wallets.reduce((s, w) => s + w.envelopes.length, 0);

  return (
    <DesktopScreen
      caption={month}
      title="Конверты"
      action={
        <Link
          href="/daily"
          className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-accent px-5 text-[15px] font-semibold text-white no-underline"
        >
          <PlusIcon size={18} />
          Внести трату
        </Link>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-accent px-[22px] py-5 text-white">
          <div className="text-sm text-accent-soft">Всего в конвертах</div>
          <div
            data-testid="total-in-envelopes"
            className="font-display text-[30px] font-semibold leading-tight"
          >
            {formatMoney(total)}
          </div>
          <div className="text-[13px] text-accent-soft">
            {wallets.length}{" "}
            {plural(wallets.length, ["кошелёк", "кошелька", "кошельков"])} ·{" "}
            {countEnvelopes(envelopeCount)}
          </div>
        </div>

        <Link
          href="/daily"
          className="flex flex-col gap-2 rounded-[20px] bg-surface px-[22px] py-5 text-ink no-underline"
        >
          <div className="text-sm text-ink-muted">
            На жизнь осталось
            {income?.nextIncomeDate &&
              ` до ${formatDay(income.nextIncomeDate, today)}`}
          </div>
          <div
            data-testid="daily-remaining"
            className="font-display text-[30px] font-semibold leading-tight"
          >
            {daily ? formatMoney(daily.remaining) : "—"}
          </div>
          {daily ? (
            <>
              <Bar
                share={daily.budget > 0 ? daily.spent / daily.budget : 0}
                tone={daily.remaining < 0 ? "warn" : "accent"}
              />
              <div className="text-[13px] text-ink-muted">
                потрачено {formatMoney(daily.spent)} из{" "}
                {formatMoney(daily.budget)}
                {daily.perDay !== null &&
                  ` · ≈ ${formatMoney(daily.perDay)} в день`}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-ink-muted">
              Появится после первой раскладки зарплаты
            </div>
          )}
        </Link>

        <div className="flex flex-col gap-1.5 rounded-[20px] bg-surface px-[22px] py-5">
          <div className="text-sm text-ink-muted">Откладывать в месяц</div>
          <div className="font-display text-[30px] font-semibold leading-tight">
            {formatMoney(contributions)}
          </div>
          {minus > 0 && (
            <div className="text-[13px] font-medium text-warn">
              {countEnvelopes(minus)} в минусе
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <PanelTitle
            aside={
              <Link href="/wallets" className="text-sm font-semibold">
                Настроить
              </Link>
            }
          >
            Кошельки
          </PanelTitle>
          {wallets.length === 0 ? (
            <Panel className="text-[15px] text-ink-muted">
              <div>
                Кошельков пока нет.{" "}
                <Link href="/wallets/new" className="font-semibold">
                  Создать первый
                </Link>
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {wallets.map((w) => (
                <WalletCard key={w.id} wallet={w} />
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Panel>
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                <ArrowUpIcon size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="text-base font-semibold">Пришли деньги?</div>
                <div className="text-sm text-ink-muted">
                  Разложу по конвертам за минуту
                </div>
              </div>
            </div>
            <Link
              href="/income"
              className="flex min-h-[46px] items-center justify-center rounded-[14px] bg-accent-soft text-[15px] font-semibold text-accent-strong no-underline"
            >
              Разложить зарплату
            </Link>
          </Panel>

          <Panel>
            <PanelTitle
              aside={
                <Link href="/daily" className="text-sm font-semibold">
                  Все
                </Link>
              }
            >
              Повседневные траты
            </PanelTitle>
            {categories.length === 0 ? (
              <div className="text-sm text-ink-muted">Категорий пока нет</div>
            ) : (
              categories.map((c) => (
                <CategoryProgress
                  key={c.id}
                  name={c.name}
                  limit={c.monthlyLimit}
                  spent={c.spent}
                  compact
                />
              ))
            )}
          </Panel>
        </div>
      </div>
    </DesktopScreen>
  );
}
