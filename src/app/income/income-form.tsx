"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Panel, PanelTitle } from "@/components/desktop";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  Notice,
  SectionTitle,
  primaryButtonClass,
} from "@/components/ui-kit";
import {
  planAllocation,
  type AllocationEnvelope,
  type AllocationPlan,
  type AllocationWallet,
  type WalletSurplus,
} from "@/domain/allocation";
import { dailySummary } from "@/domain/daily";
import { formatMoney, parseMoney } from "@/domain/money";
import { countEnvelopes, formatDay, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { allocateIncome } from "@/server/actions";

const KINDS = [
  { value: "salary", label: "Зарплата" },
  { value: "advance", label: "Аванс" },
  { value: "other", label: "Другое" },
] as const;

function SurplusNotice({ surplus }: { surplus: WalletSurplus }) {
  const fullCount = surplus.fullEnvelopeNames.length;
  const receivers = surplus.receivers
    .map((r) =>
      surplus.receivers.length > 1
        ? `${quoted(r.name)} (${formatMoney(r.amount)})`
        : quoted(r.name),
    )
    .join(" и ");
  return (
    <Notice
      title={`Излишек ${formatMoney(surplus.amount)} в ${surplus.walletName}`}
    >
      {surplus.allFull ? (
        <>
          Все конверты кошелька полные, их взносы останутся в них сверх потолка.
        </>
      ) : (
        <>
          {countEnvelopes(fullCount)} уже{" "}
          {fullCount === 1 ? "полный" : "полные"} (
          {surplus.fullEnvelopeNames.join(", ")}), их взносы уйдут в {receivers}{" "}
          по приоритету.
        </>
      )}
    </Notice>
  );
}

/** Shown when the income is smaller than all contributions. */
function ShortageNotice({ plan }: { plan: AllocationPlan }) {
  if (plan.shortage <= 0) return null;
  return plan.allSelected ? (
    <Notice
      tone="warn"
      title={`Не хватает ${formatMoney(plan.shortage)} на все взносы`}
    >
      Раздам по порядку кошельков и приоритету конвертов. Снимите галочку, чтобы
      кошелёк в этот раз ничего не получил. На повседневные траты ничего не
      останется.
    </Notice>
  ) : (
    <Notice
      tone="warn"
      title={`Не хватает ${formatMoney(plan.shortage)} на взносы отмеченных кошельков`}
    >
      На повседневные траты ничего не останется.
    </Notice>
  );
}

/** Wallets in their order with a checkbox: who gets money when it is short. */
function WalletChoice({
  plan,
  skipped,
  onToggle,
  rowClassName,
}: {
  plan: AllocationPlan;
  skipped: string[];
  onToggle: (walletId: string) => void;
  rowClassName?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Кошельки, которые получат деньги"
      className="flex flex-col"
    >
      {plan.byWallet.map((w) => (
        <label
          key={w.walletId}
          htmlFor={`wallet-${w.walletId}`}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 text-[15px]",
            rowClassName,
          )}
        >
          <Checkbox
            id={`wallet-${w.walletId}`}
            checked={!skipped.includes(w.walletId)}
            onCheckedChange={() => onToggle(w.walletId)}
          />
          <span className="min-w-0 grow">{w.name}</span>
          <span className="font-semibold">{formatMoney(w.amount)}</span>
        </label>
      ))}
    </div>
  );
}

export function IncomeForm({
  wallets,
  envelopes,
  today,
  variant = "screen",
}: {
  wallets: AllocationWallet[];
  envelopes: AllocationEnvelope[];
  today: string;
  /** "desktop": form on the left, preview of the allocation on the right. */
  variant?: "screen" | "desktop";
}) {
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("salary");
  const [nextDate, setNextDate] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const valid = amount > 0;
  const totalContributions = useMemo(
    () => planAllocation(wallets, envelopes, 0).totalContributions,
    [wallets, envelopes],
  );
  const plan = useMemo(
    () => planAllocation(wallets, envelopes, valid ? amount : 0, skipped),
    [wallets, envelopes, amount, valid, skipped],
  );
  const envelopeShare = valid ? plan.toEnvelopes / amount : 0;

  function changeAmount(text: string) {
    setAmountText(text);
    // Once the income covers everything again, the choice starts over.
    if ((parseMoney(text) ?? 0) >= totalContributions) setSkipped([]);
  }

  function toggleWallet(walletId: string) {
    setSkipped((current) =>
      current.includes(walletId)
        ? current.filter((id) => id !== walletId)
        : [...current, walletId],
    );
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const result = await allocateIncome({
      amount,
      kind,
      date: today,
      nextIncomeDate: nextDate === "" ? null : nextDate,
      skippedWalletIds: plan.needsChoice ? skipped : [],
    });
    if (result.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  if (variant === "desktop") {
    const perDay =
      valid && nextDate !== ""
        ? dailySummary({
            budget: plan.toDaily,
            spent: 0,
            today,
            nextIncomeDate: nextDate,
          }).perDay
        : null;
    const largest = Math.max(...plan.wallets.map((w) => w.amount), 0);
    return (
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 max-w-[440px] flex-[1_1_340px]">
          <Panel>
            <h2 className="m-0 text-lg font-semibold">
              <label htmlFor="income">Сколько пришло</label>
            </h2>
            <div className="flex items-baseline gap-2 rounded-[14px] bg-surface-sunken px-4 py-1.5">
              <MoneyInput
                id="income"
                value={amountText}
                onChange={changeAmount}
                size="lg"
                autoFocus
                className="text-3xl"
              />
              <span className="font-display text-[22px] text-ink-muted">₽</span>
            </div>
            <div
              role="group"
              aria-label="Вид дохода"
              className="flex flex-wrap gap-2"
            >
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "min-h-10 rounded-full px-3.5 text-sm",
                    kind === k.value
                      ? "border-2 border-accent bg-accent-soft font-semibold text-accent-strong"
                      : "bg-surface-sunken text-ink",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="next-income" className="text-sm font-semibold">
                Следующие деньги придут
              </label>
              <input
                id="next-income"
                type="date"
                min={today}
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="h-[46px] min-w-0 rounded-[12px] bg-surface-sunken px-3.5 text-base text-ink outline-none"
              />
            </div>
            {error && <Notice tone="warn" title={error} />}
            <button
              type="button"
              disabled={!valid || saving}
              onClick={submit}
              className="min-h-[50px] rounded-[14px] bg-accent text-base font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Раскладываю…" : "Разложить"}
            </button>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Panel>
            <PanelTitle
              aside={
                <span className="text-[13px] text-ink-muted">
                  ещё ничего не сохранено
                </span>
              }
            >
              Как я разложу
            </PanelTitle>
            {valid ? (
              <>
                <div
                  role="img"
                  aria-label={`Из ${formatMoney(amount)}: ${formatMoney(plan.toEnvelopes)} в конверты, ${formatMoney(plan.toDaily)} на повседневные траты`}
                  className="flex h-[18px] gap-1"
                >
                  {plan.toEnvelopes > 0 && (
                    <div
                      className="rounded-l-[8px] rounded-r-[3px] bg-accent"
                      style={{ width: `${envelopeShare * 100}%` }}
                    />
                  )}
                  {plan.toDaily > 0 && (
                    <div
                      className="rounded-l-[3px] rounded-r-[8px] bg-warn-bar"
                      style={{ width: `${(1 - envelopeShare) * 100}%` }}
                    />
                  )}
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1.5 size-3 shrink-0 rounded-[4px] bg-accent" />
                    <div>
                      <div className="text-sm text-ink-muted">В конверты</div>
                      <div
                        data-testid="to-envelopes"
                        className="font-display text-2xl font-semibold"
                      >
                        {formatMoney(plan.toEnvelopes)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1.5 size-3 shrink-0 rounded-[4px] bg-warn-bar" />
                    <div>
                      <div className="text-sm text-ink-muted">
                        На повседневные траты
                      </div>
                      <div
                        data-testid="to-daily"
                        className="font-display text-2xl font-semibold"
                      >
                        {formatMoney(plan.toDaily)}
                      </div>
                      <div className="text-[13px] text-ink-muted">
                        {perDay !== null
                          ? `≈ ${formatMoney(perDay)} в день до ${formatDay(nextDate, today)}`
                          : "всё, что осталось после конвертов"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[15px] text-ink-muted">
                Введите сумму, и я покажу, сколько уйдёт в конверты и сколько
                останется на жизнь.
              </div>
            )}
          </Panel>

          {valid && <ShortageNotice plan={plan} />}

          {valid && plan.needsChoice && (
            <Panel>
              <PanelTitle
                aside={
                  <span className="text-[13px] text-ink-muted">
                    отметьте, кто получит деньги
                  </span>
                }
              >
                Кошельки
              </PanelTitle>
              <WalletChoice
                plan={plan}
                skipped={skipped}
                onToggle={toggleWallet}
                rowClassName="border-t border-line"
              />
            </Panel>
          )}

          {valid && !plan.needsChoice && plan.wallets.length > 0 && (
            <Panel>
              <PanelTitle>Взносы по кошелькам</PanelTitle>
              <div className="flex flex-col">
                {plan.wallets.map((w) => (
                  <div
                    key={w.walletId}
                    className="flex min-h-11 items-center gap-3 border-t border-line text-[15px]"
                  >
                    <div className="min-w-0 grow">{w.name}</div>
                    <div className="w-40 shrink-0">
                      <div className="h-1.5 rounded-[3px] bg-line">
                        <div
                          className="h-1.5 rounded-[3px] bg-accent"
                          style={{
                            width: `${largest > 0 ? Math.round((w.amount / largest) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="min-w-[90px] text-right font-semibold">
                      {formatMoney(w.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {valid &&
            plan.surpluses.map((s) => (
              <SurplusNotice key={s.walletId} surplus={s} />
            ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="income" className="text-[15px] font-semibold">
            Сколько пришло
          </label>
          <MoneyField>
            <MoneyInput
              id="income"
              value={amountText}
              onChange={changeAmount}
              size="lg"
              autoFocus
            />
          </MoneyField>
        </div>
        <div
          role="group"
          aria-label="Вид дохода"
          className="flex flex-wrap gap-2"
        >
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm",
                kind === k.value
                  ? "bg-accent font-semibold text-white"
                  : "bg-surface-sunken text-ink",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="next-income" className="text-[15px] font-semibold">
            Следующие деньги придут
          </label>
          <input
            id="next-income"
            type="date"
            min={today}
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            className="h-[52px] rounded-[14px] bg-surface-sunken px-3.5 text-[17px] text-ink outline-none"
          />
          <div className="text-[13px] text-ink-muted">
            По этой дате посчитаю, сколько можно тратить в день
          </div>
        </div>
      </Card>

      {valid && (
        <>
          <SectionTitle>Как я разложу</SectionTitle>
          <div
            role="img"
            aria-label={`Из ${formatMoney(amount)}: ${formatMoney(plan.toEnvelopes)} в конверты, ${formatMoney(plan.toDaily)} на повседневные траты`}
            className="flex h-3.5 gap-[3px]"
          >
            {plan.toEnvelopes > 0 && (
              <div
                className="rounded-l-[6px] rounded-r-[2px] bg-accent"
                style={{ width: `${envelopeShare * 100}%` }}
              />
            )}
            {plan.toDaily > 0 && (
              <div
                className="rounded-l-[2px] rounded-r-[6px] bg-warn-bar"
                style={{ width: `${(1 - envelopeShare) * 100}%` }}
              />
            )}
          </div>

          <ShortageNotice plan={plan} />

          <Card className="flex flex-col px-4 py-1">
            <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line">
              <div className="size-2.5 rounded-[3px] bg-accent" />
              <div className="grow text-base font-semibold">В конверты</div>
              <div
                data-testid="to-envelopes"
                className="text-base font-semibold"
              >
                {formatMoney(plan.toEnvelopes)}
              </div>
            </div>
            {plan.needsChoice && (
              <div className="border-b border-line py-1">
                <WalletChoice
                  plan={plan}
                  skipped={skipped}
                  onToggle={toggleWallet}
                />
              </div>
            )}
            {!plan.needsChoice && plan.wallets.length > 0 && (
              <div className="flex flex-col border-b border-line pb-2 pl-5 pt-1.5 text-sm text-ink-muted">
                {plan.wallets.map((w) => (
                  <div
                    key={w.walletId}
                    className="flex min-h-[30px] items-center"
                  >
                    <div className="grow">{w.name}</div>
                    <div>{formatMoney(w.amount, { currency: false })}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex min-h-16 items-center gap-2.5">
              <div className="size-2.5 rounded-[3px] bg-warn-bar" />
              <div className="flex grow flex-col gap-0.5">
                <div className="text-base font-semibold">
                  На повседневные траты
                </div>
                <div className="text-[13px] text-ink-muted">
                  всё, что осталось после конвертов
                </div>
              </div>
              <div data-testid="to-daily" className="text-base font-semibold">
                {formatMoney(plan.toDaily)}
              </div>
            </div>
          </Card>

          {plan.surpluses.map((s) => (
            <SurplusNotice key={s.walletId} surplus={s} />
          ))}
        </>
      )}

      {error && <Notice tone="warn" title={error} />}
      <Spacer />
      <button
        type="button"
        disabled={!valid || saving}
        onClick={submit}
        className={primaryButtonClass}
      >
        {saving ? "Раскладываю…" : "Разложить"}
      </button>
    </>
  );
}
