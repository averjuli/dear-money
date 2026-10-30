"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import {
  Card,
  Notice,
  SectionTitle,
  primaryButtonClass,
} from "@/components/ui-kit";
import {
  planAllocation,
  type AllocationEnvelope,
  type AllocationWallet,
  type WalletSurplus,
} from "@/domain/allocation";
import { formatMoney, parseMoney } from "@/domain/money";
import { countEnvelopes, quoted } from "@/lib/text";
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
      {surplus.receivers.length > 0 ? (
        <>
          {countEnvelopes(fullCount)} уже{" "}
          {fullCount === 1 ? "полный" : "полные"} (
          {surplus.fullEnvelopeNames.join(", ")}), их взносы уйдут в {receivers}{" "}
          по приоритету.
        </>
      ) : (
        <>
          Все конверты кошелька полные, поэтому их взносы уйдут на повседневные
          траты.
        </>
      )}
      {surplus.receivers.length > 0 && surplus.toDaily > 0 && (
        <>
          {" "}
          {formatMoney(surplus.toDaily)} не поместятся до потолков и уйдут на
          повседневные траты.
        </>
      )}
    </Notice>
  );
}

export function IncomeForm({
  wallets,
  envelopes,
  today,
}: {
  wallets: AllocationWallet[];
  envelopes: AllocationEnvelope[];
  today: string;
}) {
  const router = useRouter();
  const [amountText, setAmountText] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("salary");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const valid = amount > 0;
  const plan = useMemo(
    () => planAllocation(wallets, envelopes, valid ? amount : 0),
    [wallets, envelopes, amount, valid],
  );
  const envelopeShare = valid ? plan.toEnvelopes / amount : 0;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const result = await allocateIncome({
      amount,
      kind,
      date: today,
      nextIncomeDate: nextDate === "" ? null : nextDate,
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
              onChange={setAmountText}
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

          {plan.shortage > 0 && (
            <Notice
              tone="warn"
              title={`Не хватает ${formatMoney(plan.shortage)} на все взносы`}
            >
              Раздам по порядку кошельков и приоритету конвертов, пока деньги не
              кончатся. На повседневные траты ничего не останется.
            </Notice>
          )}

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
            {plan.wallets.length > 0 && (
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
