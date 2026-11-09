"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import { remainingAfterExpense } from "@/domain/daily";
import { expenseHint } from "@/domain/expense";
import { formatMoney, formatMoneyInput, parseMoney } from "@/domain/money";
import { countTimes, quoted } from "@/lib/text";
import { cn } from "@/lib/utils";
import { deleteExpense, saveCategory, saveExpense } from "@/server/actions";

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
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
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
        !dashed && !selected && "bg-surface",
        !dashed && !selected && "text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** «+ Новая категория»: name and optional monthly limit, created right away. */
function NewCategory({
  onCreated,
}: {
  onCreated: (category: PickCategory) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [limitText, setLimitText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limit = limitText.trim() === "" ? null : parseMoney(limitText);
  const limitValid = limitText.trim() === "" || (limit !== null && limit > 0);
  const canAdd = name.trim() !== "" && limitValid && !saving;

  if (!open) {
    return (
      <Chip dashed onClick={() => setOpen(true)}>
        + Новая категория
      </Chip>
    );
  }

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    const result = await saveCategory({ name, monthlyLimit: limit });
    if (result.ok && result.id) {
      onCreated({ id: result.id, name: name.trim() });
      setName("");
      setLimitText("");
      setOpen(false);
    } else if (!result.ok) {
      setError(result.error);
    }
    setSaving(false);
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-[20px] bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-category-name"
          className="text-[13px] text-ink-muted"
        >
          Название
        </label>
        <input
          id="new-category-name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-[46px] rounded-[10px] bg-surface-sunken px-3 text-[15px] text-ink outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="new-category-limit"
          className="text-[13px] text-ink-muted"
        >
          Лимит в месяц, необязательно
        </label>
        <MoneyField>
          <MoneyInput
            id="new-category-limit"
            value={limitText}
            onChange={setLimitText}
            placeholder="без лимита"
          />
        </MoneyField>
        {!limitValid && (
          <div className="text-[13px] text-warn">
            Лимит больше нуля или пустое поле
          </div>
        )}
      </div>
      {error && <div className="text-[13px] text-warn">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-[12px] bg-surface-sunken text-[15px] text-ink"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className="min-h-11 rounded-[12px] bg-accent text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Добавляю…" : "Добавить"}
        </button>
      </div>
    </div>
  );
}

export function ExpenseForm({
  wallets,
  categories,
  keptCategory = null,
  recentEnvelopeIds,
  recentCategoryIds,
  initial,
  initialMode,
  backHref,
  today,
  dailyRemaining = null,
}: {
  wallets: PickWallet[];
  categories: PickCategory[];
  /** Category of the edited expense when it has been deleted: still selectable. */
  keptCategory?: PickCategory | null;
  recentEnvelopeIds: string[];
  recentCategoryIds: string[];
  initial: ExpenseInitial | null;
  initialMode: Mode;
  backHref: string;
  today: string;
  /** What is left for daily life now; shows the hint for a daily expense. */
  dailyRemaining?: number | null;
}) {
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
  const [created, setCreated] = useState<PickCategory[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = parseMoney(amountText) ?? 0;
  const canSave =
    amount > 0 &&
    categoryId !== null &&
    (mode === "daily" || envelopeId !== null) &&
    !saving;

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
  // Categories made in this form show up before the page data is refreshed.
  const allCategories = [
    ...(keptCategory ? [keptCategory] : []),
    ...categories,
    ...created,
  ].filter((c, i, list) => list.findIndex((x) => x.id === c.id) === i);
  const categoryById = new Map(allCategories.map((c) => [c.id, c]));
  const recentCategories = [
    ...created.map((c) => c.id).reverse(),
    ...recentCategoryIds,
  ]
    .filter((id, i, list) => list.indexOf(id) === i)
    .map((id) => categoryById.get(id))
    .filter((c): c is PickCategory => Boolean(c));
  const restCategories = allCategories.filter(
    (c) => !recentCategories.some((r) => r.id === c.id),
  );
  const categoryChips = (
    <div className="flex flex-wrap gap-2">
      {[...recentCategories, ...restCategories].map((c) => (
        <Chip
          key={c.id}
          selected={categoryId === c.id}
          onClick={() => setCategoryId(c.id)}
        >
          {c.name}
        </Chip>
      ))}
      <NewCategory
        onCreated={(c) => {
          setCreated((list) => [...list, c]);
          setCategoryId(c.id);
        }}
      />
    </div>
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
      categoryId,
    });
    if (result.ok) {
      router.push(backHref);
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
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

      <div className="flex flex-col gap-2.5">
        <div className="text-[15px] font-semibold">Откуда списать</div>
        <div
          role="group"
          aria-label="Тип траты"
          className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface p-1"
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
                mode === value &&
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
                >
                  {e.name}
                </Chip>
              ))}
              <Chip dashed onClick={() => setShowAll(!showAll)}>
                {showAll ? "Скрыть список" : "Все конверты"}
              </Chip>
            </div>
            {showAll && (
              <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-4">
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
            <div className="text-[15px] font-semibold">Категория</div>
            {categoryChips}
          </>
        ) : (
          categoryChips
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

      {error && <Notice tone="warn" title={error} />}
      <Spacer />
      <button
        type="button"
        disabled={!canSave}
        onClick={save}
        className={primaryButtonClass}
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
