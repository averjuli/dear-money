"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import { remainingAfterExpense } from "@/domain/daily";
import { expenseHint } from "@/domain/expense";
import { formatMoney, formatMoneyInput, parseMoney } from "@/domain/money";
import { countTimes, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { deleteExpense, saveExpense } from "@/server/actions";

export interface PickEnvelope {
  id: string;
  name: string;
  balance: number;
  costPerTime: number;
}

export interface PickWallet {
  id: string;
  name: string;
  envelopes: PickEnvelope[];
}

export interface PickCategory {
  id: string;
  name: string;
}

export interface ExpenseInitial {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  envelopeId: string | null;
  categoryId: string | null;
}

type Mode = "daily" | "envelope";

function Chip({
  selected,
  onClick,
  children,
  dashed,
  sunken,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
  /** On a white panel the unselected chip is grey instead of white. */
  sunken?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={dashed ? undefined : selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-3.5 text-[15px]",
        dashed && "border-2 border-dashed border-dash bg-transparent text-ink",
        !dashed &&
          selected &&
          "border-2 border-accent bg-accent-soft font-semibold text-accent-strong",
        !dashed && !selected && (sunken ? "bg-surface-sunken" : "bg-surface"),
        !dashed && !selected && "text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function ExpenseForm({
  wallets,
  categories,
  recentEnvelopeIds,
  recentCategoryIds,
  initial,
  initialMode,
  backHref,
  today,
  variant = "screen",
  dailyRemaining = null,
}: {
  wallets: PickWallet[];
  categories: PickCategory[];
  recentEnvelopeIds: string[];
  recentCategoryIds: string[];
  initial: ExpenseInitial | null;
  initialMode: Mode;
  backHref: string;
  today: string;
  /** "panel": always open on the desktop «Траты» screen, clears itself after saving. */
  variant?: "screen" | "panel";
  /** What is left for daily life now; shows the hint for a daily expense. */
  dailyRemaining?: number | null;
}) {
  const panel = variant === "panel";
  const router = useRouter();
  const allEnvelopes = useMemo(
    () => wallets.flatMap((w) => w.envelopes),
    [wallets],
  );
  const envelopeById = useMemo(
    () => new Map(allEnvelopes.map((e) => [e.id, e])),
    [allEnvelopes],
  );

  const [mode, setMode] = useState<Mode>(
    initial ? (initial.envelopeId ? "envelope" : "daily") : initialMode,
  );
  const [amountText, setAmountText] = useState(
    initial ? formatMoneyInput(initial.amount) : "",
  );
  const [envelopeId, setEnvelopeId] = useState<string | null>(
    initial?.envelopeId ?? null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.categoryId ?? null,
  );
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? "");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const target = mode === "envelope" ? envelopeId : categoryId;
  const canSave = amount > 0 && target !== null && !saving;

  // When editing, the stored balance already includes this expense.
  const selected = envelopeId ? envelopeById.get(envelopeId) : undefined;
  const hint =
    mode === "envelope" && selected && amount > 0
      ? expenseHint(
          {
            balance:
              selected.balance +
              (initial?.envelopeId === selected.id ? initial.amount : 0),
            costPerTime: selected.costPerTime,
          },
          amount,
        )
      : null;
  const dailyAfter =
    mode === "daily" && dailyRemaining !== null && amount > 0
      ? remainingAfterExpense(dailyRemaining, amount)
      : null;

  const recentEnvelopes = recentEnvelopeIds
    .map((id) => envelopeById.get(id))
    .filter((e): e is PickEnvelope => Boolean(e));
  if (
    envelopeId &&
    !recentEnvelopes.some((e) => e.id === envelopeId) &&
    selected
  ) {
    recentEnvelopes.push(selected);
  }
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const recentCategories = recentCategoryIds
    .map((id) => categoryById.get(id))
    .filter((c): c is PickCategory => Boolean(c));
  const restCategories = categories.filter(
    (c) => !recentCategoryIds.includes(c.id),
  );

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await saveExpense({
      id: initial?.id,
      amount,
      date,
      note,
      envelopeId: mode === "envelope" ? envelopeId : null,
      categoryId: mode === "daily" ? categoryId : null,
    });
    if (result.ok && panel) {
      setAmountText("");
      setNote("");
      setDate(today);
      setSaving(false);
      router.refresh();
    } else if (result.ok) {
      router.push(backHref);
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <>
      {panel ? (
        <div className="flex items-baseline gap-2 rounded-[14px] bg-surface-sunken px-4 py-1.5">
          <label htmlFor="sum" className="sr-only">
            Сумма
          </label>
          <MoneyInput
            id="sum"
            value={amountText}
            onChange={setAmountText}
            size="lg"
            autoFocus
            className="h-[52px] text-[28px]"
          />
          <span className="font-display text-[22px] text-ink-muted">₽</span>
        </div>
      ) : (
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
      )}

      <div className="flex flex-col gap-2.5">
        {!panel && (
          <div className="text-[15px] font-semibold">Откуда списать</div>
        )}
        <div
          role="group"
          aria-label="Тип траты"
          className={cn(
            "grid grid-cols-2 gap-1 rounded-[14px] p-1",
            panel ? "bg-surface-sunken" : "bg-surface",
          )}
        >
          {(
            [
              ["daily", "Повседневное"],
              ["envelope", "Из конверта"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "min-h-11 rounded-[10px] text-[15px]",
                mode === value && panel && "bg-surface font-semibold text-ink",
                mode === value &&
                  !panel &&
                  "bg-accent-soft font-semibold text-accent-strong",
                mode !== value && "bg-transparent text-ink-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "envelope" ? (
          <>
            <div className="text-[13px] text-ink-muted">Недавние</div>
            <div className="flex flex-wrap gap-2">
              {recentEnvelopes.map((e) => (
                <Chip
                  key={e.id}
                  selected={envelopeId === e.id}
                  onClick={() => setEnvelopeId(e.id)}
                  sunken={panel}
                >
                  {e.name}
                </Chip>
              ))}
              <Chip dashed onClick={() => setShowAll(!showAll)}>
                {showAll ? "Скрыть список" : "Все конверты"}
              </Chip>
            </div>
            {showAll && (
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-[20px] p-4",
                  panel ? "border border-line" : "bg-surface",
                )}
              >
                {wallets.map((w) => (
                  <div key={w.id} className="flex flex-col gap-2">
                    <div className="text-[13px] font-semibold text-ink-muted">
                      {w.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {w.envelopes.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          aria-pressed={envelopeId === e.id}
                          onClick={() => {
                            setEnvelopeId(e.id);
                            setShowAll(false);
                          }}
                          className={cn(
                            "min-h-11 rounded-full px-3.5 text-[15px]",
                            envelopeId === e.id
                              ? "bg-accent-soft font-semibold text-accent-strong"
                              : "bg-surface-sunken text-ink",
                          )}
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {categories.length === 0 ? (
              <div className="text-sm text-ink-muted">
                Категорий пока нет: добавьте их на экране «Траты».
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[...recentCategories, ...restCategories].map((c) => (
                  <Chip
                    key={c.id}
                    selected={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    sunken={panel}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hint && selected && (
        <div
          data-testid="expense-hint"
          className={cn(
            "rounded-[16px] px-3.5 py-3 text-sm leading-snug",
            hint.negative
              ? "bg-warn-soft text-warn"
              : "bg-accent-soft text-accent-strong",
          )}
        >
          В конверте {quoted(selected.name)} станет{" "}
          {formatMoney(hint.newBalance)}
          {hint.negative
            ? "."
            : hint.times > 0
              ? `, хватит ещё на ${countTimes(hint.times)}.`
              : ", на целый раз уже не хватит."}
        </div>
      )}

      {dailyAfter !== null && (
        <div
          data-testid="daily-hint"
          className={cn(
            "rounded-[12px] px-3.5 py-2.5 text-sm",
            dailyAfter < 0
              ? "bg-warn-soft text-warn"
              : "bg-accent-soft text-accent-strong",
          )}
        >
          На жизнь останется {formatMoney(dailyAfter)}
        </div>
      )}

      {panel ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="date" className="text-[13px] text-ink-muted">
              Дата
            </label>
            <input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value || today)}
              className="h-[42px] min-w-0 rounded-[10px] bg-surface-sunken px-3 text-[15px] text-ink outline-none"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="note" className="text-[13px] text-ink-muted">
              Заметка
            </label>
            <input
              id="note"
              type="text"
              maxLength={200}
              placeholder="необязательно"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-[42px] min-w-0 rounded-[10px] bg-surface-sunken px-3 text-[15px] text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        </div>
      ) : (
        <Card className="flex flex-col px-4">
          <div className="flex min-h-14 items-center gap-2.5 border-b border-line">
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
          <div className="flex min-h-14 items-center gap-2.5">
            <label htmlFor="note" className="grow text-[15px] font-semibold">
              Заметка
            </label>
            <input
              id="note"
              type="text"
              maxLength={200}
              placeholder="необязательно"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-44 bg-transparent text-right text-[15px] text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        </Card>
      )}

      {error && <Notice tone="warn" title={error} />}
      {!panel && <Spacer />}
      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className={
          panel
            ? "min-h-12 rounded-[14px] bg-accent text-base font-semibold text-white disabled:opacity-50"
            : primaryButtonClass
        }
      >
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
      {initial && (
        <ConfirmButton
          label="Удалить трату"
          title="Удалить трату?"
          description={`${formatMoney(initial.amount)} вернутся туда, откуда были списаны.`}
          onConfirm={async () => {
            const result = await deleteExpense(initial.id);
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
