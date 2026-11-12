"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { formatMoney, formatMoneyInput, parseMoney } from "@/domain/money";
import {
  countEnvelopes,
  INCOME_KINDS,
  quoted,
  type IncomeKind,
} from "@/lib/text";
import { cn } from "@/lib/utils";
import { allocateIncome, updateIncome } from "@/server/actions";

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
}: {
  plan: AllocationPlan;
  skipped: string[];
  onToggle: (walletId: string) => void;
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
          className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]"
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

/** "" → no day; a whole number from 1 to 31 → the day; anything else → undefined. */
function parseDay(text: string): number | null | undefined {
  if (text === "") return null;
  const day = Number(text);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}

function DayField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="h-[52px] w-full min-w-0 rounded-[14px] bg-surface-sunken px-3.5 text-[17px] text-ink outline-none"
        />
        <span className="shrink-0 text-[15px] text-ink-muted">числа</span>
      </div>
    </div>
  );
}

/** A saved income opened for correction. */
export interface IncomeCorrection {
  id: string;
  amount: number;
  kind: IncomeKind;
  skippedWalletIds: string[];
  /** The part that went to envelopes deleted since; it stays as it was. */
  toDeleted: number;
  /** Incomes entered after this one: they are laid out again. */
  nextCount: number;
  /** The address of the income screen: where «Сохранить» leads. */
  doneHref: string;
}

/**
 * «Пришли деньги». With `correction` it is the same form filled with a saved
 * income: no pay-day fields, «Сохранить» instead of «Разложить». Then
 * `wallets` and `envelopes` are as they were at the moment of the income.
 */
export function IncomeForm({
  wallets,
  envelopes,
  advanceDay = null,
  salaryDay = null,
  today = "",
  correction,
}: {
  wallets: AllocationWallet[];
  envelopes: AllocationEnvelope[];
  /** Days saved with the previous allocation, shown filled in. */
  advanceDay?: number | null;
  salaryDay?: number | null;
  today?: string;
  correction?: IncomeCorrection;
}) {
  const router = useRouter();
  const toDeleted = correction?.toDeleted ?? 0;
  const [amountText, setAmountText] = useState(
    correction ? formatMoneyInput(correction.amount) : "",
  );
  const [kind, setKind] = useState<IncomeKind>(correction?.kind ?? "salary");
  const [advanceText, setAdvanceText] = useState(
    advanceDay === null ? "" : String(advanceDay),
  );
  const [salaryText, setSalaryText] = useState(
    salaryDay === null ? "" : String(salaryDay),
  );
  const [skipped, setSkipped] = useState<string[]>(
    correction?.skippedWalletIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const valid = amount > 0;
  const totalContributions = useMemo(
    () => planAllocation(wallets, envelopes, 0).totalContributions,
    [wallets, envelopes],
  );
  // What is laid out now; the money of deleted envelopes is set aside.
  const plan = useMemo(
    () =>
      planAllocation(
        wallets,
        envelopes,
        valid ? Math.max(amount - toDeleted, 0) : 0,
        skipped,
      ),
    [wallets, envelopes, amount, valid, skipped, toDeleted],
  );
  const toEnvelopes = plan.toEnvelopes + (valid ? toDeleted : 0);
  const envelopeShare = valid ? toEnvelopes / amount : 0;

  function changeAmount(text: string) {
    setAmountText(text);
    // Once the income covers everything again, the choice starts over.
    const laidOut = Math.max((parseMoney(text) ?? 0) - toDeleted, 0);
    if (laidOut >= totalContributions) setSkipped([]);
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
    setError(null);
    if (correction) {
      setSaving(true);
      const result = await updateIncome({
        id: correction.id,
        amount,
        kind,
        skippedWalletIds: plan.needsChoice ? skipped : [],
      });
      if (result.ok) {
        router.push(correction.doneHref);
        router.refresh();
      } else {
        setError(result.error);
        setSaving(false);
      }
      return;
    }
    const advance = parseDay(advanceText);
    const salary = parseDay(salaryText);
    if (advance === undefined || salary === undefined) {
      setError("Число от 1 до 31");
      return;
    }
    setSaving(true);
    const result = await allocateIncome({
      amount,
      kind,
      date: today,
      advanceDay: advance,
      salaryDay: salary,
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
          {INCOME_KINDS.map((k) => (
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
        {!correction && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <DayField
                id="advance-day"
                label="Аванс приходит"
                value={advanceText}
                onChange={setAdvanceText}
              />
              <DayField
                id="salary-day"
                label="Зарплата приходит"
                value={salaryText}
                onChange={setSalaryText}
              />
            </div>
            <div className="text-[13px] text-ink-muted">
              По этим числам посчитаю, сколько можно тратить в день
            </div>
          </div>
        )}
      </Card>

      {valid && (
        <>
          <SectionTitle>Как я разложу</SectionTitle>
          <div
            role="img"
            aria-label={`Из ${formatMoney(amount)}: ${formatMoney(toEnvelopes)} в конверты, ${formatMoney(plan.toDaily)} на повседневные траты`}
            className="flex h-3.5 gap-[3px]"
          >
            {toEnvelopes > 0 && (
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
                {formatMoney(toEnvelopes)}
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
          {correction && correction.nextCount > 0 && (
            <div className="text-[13px] text-ink-muted">
              Следующие раскладки пересчитаются: {correction.nextCount}
            </div>
          )}
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
        {correction
          ? saving
            ? "Сохраняю…"
            : "Сохранить"
          : saving
            ? "Раскладываю…"
            : "Разложить"}
      </button>
    </>
  );
}
