"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronIcon } from "@/components/icons";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Bar, Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import {
  ceiling as ceilingOf,
  monthlyContribution,
  type PeriodUnit,
} from "@/domain/envelope";
import { formatMoney, formatMoneyInput, parseMoney } from "@/domain/money";
import { countMonths, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { deleteEnvelope, saveEnvelope } from "@/server/actions";

export interface EnvelopeFormValue {
  id: string;
  name: string;
  costPerTime: number;
  periodN: number;
  periodUnit: PeriodUnit;
  contributionOverride: number | null;
  timesToSave: number;
  startBalance: number;
  /** Current balance; equals startBalance + allocations − expenses. */
  balance: number;
  expenseCount: number;
}

const UNITS: { value: PeriodUnit; label: string }[] = [
  { value: "week", label: "недели" },
  { value: "month", label: "месяца" },
  { value: "year", label: "года" },
];

function formula(cost: number, n: number, unit: PeriodUnit): string {
  const price = formatMoney(cost);
  if (unit === "month") return `${price} ÷ ${countMonths(n)}`;
  if (unit === "year") return `${price} ÷ ${countMonths(n * 12)}`;
  return `${price} × 52 недели ÷ ${countMonths(n * 12)}`;
}

/** A card on the phone screen; a plain block inside the desktop side panel. */
function Block({
  panel,
  className,
  children,
}: {
  panel: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return panel ? (
    <div className={cn(className, "p-0")}>{children}</div>
  ) : (
    <Card className={className}>{children}</Card>
  );
}

export function EnvelopeForm({
  walletId,
  walletName,
  envelope,
  priority,
  priorityCount,
  surplusReceivers,
  variant = "screen",
}: {
  walletId: string;
  walletName: string;
  envelope: EnvelopeFormValue | null;
  priority: number;
  priorityCount: number;
  /** Where this envelope's contribution goes this month if it is full. */
  surplusReceivers: string[];
  /**
   * "panel": the side panel of the desktop wallet screen;
   * "wide": the same, full width in two columns (a new envelope on desktop).
   */
  variant?: "screen" | "panel" | "wide";
}) {
  const panel = variant !== "screen";
  const wide = variant === "wide";
  const router = useRouter();
  const [name, setName] = useState(envelope?.name ?? "");
  const [costText, setCostText] = useState(
    formatMoneyInput(envelope?.costPerTime ?? null),
  );
  const [periodText, setPeriodText] = useState(String(envelope?.periodN ?? 1));
  const [unit, setUnit] = useState<PeriodUnit>(envelope?.periodUnit ?? "month");
  const [manual, setManual] = useState(envelope?.contributionOverride != null);
  const [manualText, setManualText] = useState(
    formatMoneyInput(envelope?.contributionOverride ?? null),
  );
  const [times, setTimes] = useState(envelope?.timesToSave ?? 3);
  const [startText, setStartText] = useState(
    formatMoneyInput(envelope?.startBalance ?? 0),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cost = parseMoney(costText) ?? 0;
  const periodN = Math.max(1, Number.parseInt(periodText, 10) || 1);
  const manualAmount = manual ? parseMoney(manualText) : null;
  const startBalance = parseMoney(startText) ?? 0;
  const contribution = monthlyContribution({
    costPerTime: cost,
    periodN,
    periodUnit: unit,
    contributionOverride: manual ? (manualAmount ?? 0) : null,
  });
  // Balance changes with the start balance; allocations and expenses stay as they are.
  const balance =
    (envelope?.balance ?? 0) - (envelope?.startBalance ?? 0) + startBalance;
  const cap = ceilingOf({ costPerTime: cost, timesToSave: times });
  const full = balance >= cap && balance >= 0;
  const valid =
    name.trim() !== "" &&
    parseMoney(costText) !== null &&
    cost >= 0 &&
    (!manual || (manualAmount !== null && manualAmount >= 0)) &&
    parseMoney(startText) !== null;

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveEnvelope({
      id: envelope?.id,
      walletId,
      name,
      costPerTime: cost,
      periodN,
      periodUnit: unit,
      contributionOverride: manual ? (manualAmount ?? 0) : null,
      timesToSave: times,
      startBalance,
    });
    if (result.ok) {
      router.push(`/wallets/${walletId}`);
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  const mainBlock = (
    <Block panel={panel} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-[15px] font-semibold">
          Название
        </label>
        <input
          id="name"
          type="text"
          maxLength={80}
          autoFocus={!envelope}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-[52px] rounded-[14px] bg-surface-sunken px-3.5 text-[17px] font-medium text-ink outline-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="cost" className="text-[15px] font-semibold">
          Сколько стоит один раз
        </label>
        <MoneyField>
          <MoneyInput id="cost" value={costText} onChange={setCostText} />
        </MoneyField>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="freq" className="text-[15px] font-semibold">
          Как часто
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="whitespace-nowrap text-base text-ink-muted">
            раз в
          </span>
          <input
            id="freq"
            type="text"
            inputMode="numeric"
            value={periodText}
            onChange={(e) => {
              if (/^\d{0,3}$/.test(e.target.value))
                setPeriodText(e.target.value);
            }}
            onBlur={() => setPeriodText(String(periodN))}
            className="h-[52px] w-[60px] rounded-[14px] bg-surface-sunken text-center text-xl font-semibold text-ink outline-none"
          />
          <div
            role="group"
            aria-label="Единица времени"
            className="grid min-w-[210px] grow grid-cols-3 gap-1 rounded-[14px] bg-surface-sunken p-1"
          >
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                aria-pressed={unit === u.value}
                onClick={() => setUnit(u.value)}
                className={cn(
                  "min-h-11 rounded-[10px] text-sm",
                  unit === u.value
                    ? "bg-surface font-semibold text-ink"
                    : "bg-transparent text-ink-muted",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Block>
  );
  const contributionCard = (
    <div
      className={cn(
        "flex flex-col gap-1 bg-accent text-white",
        panel ? "rounded-[16px] px-4 py-3.5" : "rounded-[20px] px-[18px] py-4",
      )}
    >
      <div className="text-sm text-accent-soft">Откладывать в месяц</div>
      <div
        data-testid="monthly-contribution"
        className={cn(
          "font-display font-semibold leading-tight",
          panel ? "text-2xl" : "text-[30px]",
        )}
      >
        {formatMoney(contribution)}
      </div>
      <div className="text-sm text-accent-soft">
        {manual
          ? "Задано вручную"
          : `Считается само: ${formula(cost, periodN, unit)}`}
      </div>
    </div>
  );
  const manualBlock = (
    <Block panel={panel} className="flex flex-col gap-3 p-4">
      <label className="flex items-center gap-3 text-[15px] font-semibold">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => {
            setManual(e.target.checked);
            if (e.target.checked && manualText === "")
              setManualText(formatMoneyInput(contribution));
          }}
          className="size-5 accent-[#1b6b4d]"
        />
        Задать взнос вручную
      </label>
      {manual && (
        <MoneyField sign="₽/мес">
          <MoneyInput
            id="manual"
            ariaLabel="Взнос в месяц вручную"
            value={manualText}
            onChange={setManualText}
          />
        </MoneyField>
      )}
    </Block>
  );
  const timesBlock = (
    <Block panel={panel} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <label htmlFor="cap" className="grow text-[15px] font-semibold">
          На сколько раз копить
        </label>
        <button
          type="button"
          aria-label="Меньше"
          disabled={times <= 1}
          onClick={() => setTimes(Math.max(1, times - 1))}
          className="size-11 rounded-[12px] bg-surface-sunken text-[22px] text-ink disabled:opacity-40"
        >
          −
        </button>
        <input
          id="cap"
          type="text"
          inputMode="numeric"
          value={times}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 100) setTimes(n);
          }}
          className="size-11 bg-transparent text-center text-xl font-semibold text-ink outline-none"
        />
        <button
          type="button"
          aria-label="Больше"
          disabled={times >= 100}
          onClick={() => setTimes(Math.min(100, times + 1))}
          className="size-11 rounded-[12px] bg-surface-sunken text-[22px] text-ink disabled:opacity-40"
        >
          +
        </button>
      </div>
      <Bar
        share={cap > 0 ? balance / cap : 0}
        tone={balance < 0 ? "warn" : "accent"}
        label={`Накоплено ${formatMoney(balance)} из ${formatMoney(cap)}`}
      />
      <div className="flex justify-between gap-2 text-sm">
        <div className="text-ink-muted">Потолок {formatMoney(cap)}</div>
        <div
          className={cn(
            "font-semibold",
            balance < 0 ? "text-warn" : "text-accent",
          )}
        >
          {cap === 0
            ? `накоплено ${formatMoney(balance)}`
            : full
              ? `накоплено ${formatMoney(balance)}, полный`
              : `накоплено ${formatMoney(balance)}, до потолка ${formatMoney(cap - balance)}`}
        </div>
      </div>
    </Block>
  );
  const startBlock = (
    <Block panel={panel} className="flex flex-col gap-2 p-4">
      <label htmlFor="start" className="text-[15px] font-semibold">
        Начальный остаток
      </label>
      <MoneyField>
        <MoneyInput
          id="start"
          value={startText}
          onChange={setStartText}
          allowNegative
        />
      </MoneyField>
      <div className="text-[13px] text-ink-muted">
        Сколько уже лежит в конверте, например при переносе из таблицы. Может
        быть отрицательным.
      </div>
    </Block>
  );
  const rest = (
    <>
      {envelope && !panel && (
        <Link
          href={`/wallets/${walletId}`}
          className="flex min-h-[60px] items-center gap-2.5 rounded-[20px] bg-surface px-4 text-ink no-underline"
        >
          <div className="grow text-[15px] font-semibold">
            Приоритет в кошельке
          </div>
          <div className="text-[15px] text-ink-muted">
            {priority} из {priorityCount}
          </div>
          <ChevronIcon className="text-ink-muted" />
        </Link>
      )}

      {envelope && full && surplusReceivers.length > 0 && (
        <Notice title="Что будет с излишком">
          Конверт полный, поэтому его {formatMoney(contribution)} в этом месяце
          уйдут в {surplusReceivers.map(quoted).join(" и ")}. Когда вы потратите
          из {quoted(envelope.name)}, взносы вернутся сюда.
        </Notice>
      )}
      {envelope && full && surplusReceivers.length === 0 && (
        <Notice title="Что будет с излишком">
          Конверт полный, а других неполных конвертов в {walletName} нет,
          поэтому его взнос уйдёт на повседневные траты.
        </Notice>
      )}

      {error && <Notice tone="warn" title={error} />}
      {!panel && <Spacer />}
      <button
        type="button"
        disabled={!valid || saving}
        onClick={save}
        className={cn(primaryButtonClass, wide && "max-w-[360px] self-center")}
      >
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
      {envelope && (
        <ConfirmButton
          label="Удалить конверт"
          title={`Удалить конверт «${envelope.name}»?`}
          description={
            envelope.expenseCount > 0
              ? `Из конверта были траты (${envelope.expenseCount}). Они тоже удалятся.`
              : "Трат из этого конверта не было."
          }
          onConfirm={async () => {
            const result = await deleteEnvelope(envelope.id);
            if (result.ok) {
              router.push(`/wallets/${walletId}`);
              router.refresh();
            } else {
              setError(result.error);
            }
          }}
        />
      )}
    </>
  );

  if (wide) {
    return (
      <>
        <div className="grid items-start gap-x-8 gap-y-5 min-[900px]:grid-cols-2">
          <div className="flex flex-col gap-5">
            {mainBlock}
            {startBlock}
          </div>
          <div className="flex flex-col gap-5">
            {contributionCard}
            {manualBlock}
            {timesBlock}
          </div>
        </div>
        {rest}
      </>
    );
  }
  return (
    <>
      {mainBlock}
      {contributionCard}
      {manualBlock}
      {timesBlock}
      {startBlock}
      {rest}
    </>
  );
}
