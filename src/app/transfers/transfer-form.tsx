"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Chip } from "@/components/chip";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import { formatMoney, formatMoneyInput, parseMoney } from "@/domain/money";
import {
  canTransfer,
  transferHint,
  type SavedTransfer,
  type SideHint,
  type TransferSide,
} from "@/domain/transfer";
import { countTimes, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { deleteTransfer, saveTransfer } from "@/server/actions";
import type { PickWallet } from "../expenses/expense-form";

export interface TransferInitial {
  id: string;
  amount: number;
  date: string;
  from: TransferSide;
  to: TransferSide;
  /** Everything this transfer has already added to «на жизнь». */
  journaled: number;
}

type Which = "from" | "to";

const DELETED_LABEL = "Удалённый конверт";

function HintLine({
  hint,
  which,
  name,
}: {
  hint: SideHint;
  which: Which;
  name: string;
}) {
  const text =
    hint.kind === "daily"
      ? `На жизнь останется ${formatMoney(hint.remaining)}`
      : `В конверте ${quoted(name)} станет ${formatMoney(hint.newBalance)}${
          hint.negative
            ? "."
            : hint.times > 0
              ? `, хватит ${which === "from" ? "ещё " : ""}на ${countTimes(hint.times)}.`
              : which === "from"
                ? ", на целый раз уже не хватит."
                : "."
        }`;
  return (
    <div
      data-testid={`transfer-hint-${which}`}
      className={cn(
        "rounded-[16px] px-3.5 py-3 text-sm leading-snug",
        hint.negative
          ? "bg-warn-soft text-warn"
          : "bg-accent-soft text-accent-strong",
      )}
    >
      {text}
    </div>
  );
}

export function TransferForm({
  wallets,
  dailyRemaining,
  initial,
  startTo = null,
  backHref,
  today,
}: {
  wallets: PickWallet[];
  /** What is left for daily life now; null before the first allocation. */
  dailyRemaining: number | null;
  initial: TransferInitial | null;
  /** «Куда» chosen in advance (the «Пополнить» button). */
  startTo?: "daily" | null;
  backHref: string;
  today: string;
}) {
  const router = useRouter();
  const dailyAvailable = dailyRemaining !== null;

  const envelopes = useMemo(() => {
    const map = new Map<
      string,
      { name: string; walletName: string; balance: number; costPerTime: number }
    >();
    for (const w of wallets) {
      for (const e of w.envelopes) {
        map.set(e.id, {
          name: e.name,
          walletName: w.name,
          balance: e.balance,
          costPerTime: e.costPerTime,
        });
      }
    }
    return map;
  }, [wallets]);

  const initialSaved: SavedTransfer | null = initial
    ? { amount: initial.amount, from: initial.from, to: initial.to }
    : null;

  const [amountText, setAmountText] = useState(
    initial ? formatMoneyInput(initial.amount) : "",
  );
  const [from, setFrom] = useState<TransferSide | null>(initial?.from ?? null);
  const [to, setTo] = useState<TransferSide | null>(
    initial?.to ?? (startTo === "daily" ? { kind: "daily" } : null),
  );
  const [date, setDate] = useState(initial?.date ?? today);
  const [open, setOpen] = useState<Which | null>(initial ? null : "from");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const canSave =
    canTransfer({
      amount,
      from,
      to,
      date,
      today,
      dailyAvailable,
      initial: initialSaved,
    }) && !saving;

  const hint =
    amount > 0
      ? transferHint({
          amount,
          from,
          to,
          initial: initialSaved,
          lookup: (id) => envelopes.get(id),
          dailyRemaining,
          journaledDaily: initial?.journaled ?? 0,
        })
      : { from: null, to: null };

  function sideName(side: TransferSide | null): string {
    if (side === null) return "Выбрать";
    if (side.kind === "daily") return "На жизнь";
    if (side.kind === "deleted") return DELETED_LABEL;
    return envelopes.get(side.envelopeId)?.name ?? "Конверт";
  }

  function sideCaption(side: TransferSide | null): string | null {
    if (side === null || side.kind === "deleted") return null;
    if (side.kind === "daily") {
      return dailyRemaining === null
        ? null
        : `Осталось на жизнь ${formatMoney(dailyRemaining)}`;
    }
    const env = envelopes.get(side.envelopeId);
    return env
      ? `${env.walletName} · сейчас ${formatMoney(env.balance)}`
      : null;
  }

  function choose(which: Which, side: TransferSide) {
    if (which === "from") setFrom(side);
    else setTo(side);
    setOpen(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await saveTransfer({
      id: initial?.id,
      amount,
      from,
      to,
      date,
    });
    if (result.ok) {
      router.push(backHref);
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  function deleteNote(t: TransferInitial): string {
    const sum = formatMoney(t.amount);
    if (t.from.kind === "envelope") {
      return `${sum} вернутся в конверт ${quoted(sideName(t.from))}.`;
    }
    if (t.from.kind === "daily") return `${sum} вернутся на жизнь.`;
    // The source is a deleted envelope: there is nowhere to return the money.
    if (t.to.kind === "envelope") {
      return `${sum} уйдут из конверта ${quoted(sideName(t.to))}: вернуть их некуда, конверт-источник удалён.`;
    }
    if (t.to.kind === "daily") {
      return `${sum} уйдут из денег на жизнь: вернуть их некуда, конверт-источник удалён.`;
    }
    return `${sum} никуда не вернутся: оба конверта удалены.`;
  }

  function sideBlock(which: Which, label: string) {
    const side = which === "from" ? from : to;
    const caption = sideCaption(side);
    const savedSide = initial?.[which];
    return (
      <div
        role="group"
        aria-label={label}
        className="flex flex-col gap-2 rounded-[20px] bg-surface px-3.5 py-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">{label}</span>
          <Chip
            sunken
            selected={side !== null}
            onClick={() => setOpen(open === which ? null : which)}
          >
            {sideName(side)}
          </Chip>
        </div>
        {caption && <div className="text-[13px] text-ink-muted">{caption}</div>}
        {open === which && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              {dailyAvailable && (
                <Chip
                  sunken
                  selected={side?.kind === "daily"}
                  onClick={() => choose(which, { kind: "daily" })}
                >
                  На жизнь
                </Chip>
              )}
              {savedSide?.kind === "deleted" && (
                <Chip
                  sunken
                  selected={side?.kind === "deleted"}
                  onClick={() => choose(which, { kind: "deleted" })}
                >
                  {DELETED_LABEL}
                </Chip>
              )}
            </div>
            {wallets.map((w) => (
              <div key={w.id} className="flex flex-col gap-2">
                <div className="text-[13px] font-semibold text-ink-muted">
                  {w.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {w.envelopes.map((e) => (
                    <Chip
                      sunken
                      key={e.id}
                      selected={
                        side?.kind === "envelope" && side.envelopeId === e.id
                      }
                      onClick={() =>
                        choose(which, { kind: "envelope", envelopeId: e.id })
                      }
                    >
                      {e.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1.5 rounded-[24px] bg-surface p-5">
        <label htmlFor="sum" className="text-sm text-ink-muted">
          Сумма
        </label>
        <div className="flex items-baseline gap-2">
          <MoneyInput
            id="sum"
            value={amountText}
            onChange={setAmountText}
            size="xl"
            autoFocus={!initial}
            className="w-[200px] grow-0 text-right"
          />
          <span className="font-display text-[28px] font-medium text-ink-muted">
            ₽
          </span>
        </div>
      </div>

      {sideBlock("from", "Откуда")}
      {sideBlock("to", "Куда")}

      <Card className="flex flex-col px-4">
        <div className="flex min-h-14 items-center gap-2.5">
          <label htmlFor="date" className="grow text-[15px] font-semibold">
            Дата
          </label>
          <input
            id="date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value || today)}
            className="bg-transparent text-right text-[15px] text-ink-muted outline-none"
          />
        </div>
      </Card>

      {hint.from && (
        <HintLine hint={hint.from} which="from" name={sideName(from)} />
      )}
      {hint.to && <HintLine hint={hint.to} which="to" name={sideName(to)} />}

      {error && <Notice tone="warn" title={error} />}
      <Spacer />
      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className={primaryButtonClass}
      >
        {saving
          ? initial
            ? "Сохраняю…"
            : "Перевожу…"
          : initial
            ? "Сохранить"
            : "Перевести"}
      </button>
      {initial && (
        <ConfirmButton
          label="Удалить перевод"
          title="Удалить перевод?"
          description={deleteNote(initial)}
          onConfirm={async () => {
            const result = await deleteTransfer(initial.id);
            if (result.ok) {
              router.push(backHref);
              router.refresh();
            } else {
              setError(result.error);
            }
          }}
        />
      )}
    </>
  );
}
