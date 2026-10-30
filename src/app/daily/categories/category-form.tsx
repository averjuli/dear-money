"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Spacer } from "@/components/screen";
import { Card, Notice, primaryButtonClass } from "@/components/ui-kit";
import { formatMoneyInput, parseMoney } from "@/domain/money";
import { deleteCategory, saveCategory } from "@/server/actions";

export function CategoryForm({
  category,
  expenseCount,
  children,
}: {
  category: { id: string; name: string; monthlyLimit: number | null } | null;
  expenseCount: number;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [limitText, setLimitText] = useState(
    formatMoneyInput(category?.monthlyLimit ?? null),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limit = limitText.trim() === "" ? null : parseMoney(limitText);
  const limitValid = limitText.trim() === "" || (limit !== null && limit > 0);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveCategory({
      id: category?.id,
      name,
      monthlyLimit: limit,
    });
    if (result.ok) {
      router.push("/daily");
      router.refresh();
    } else {
      setError(result.error);
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-[15px] font-semibold">
            Название
          </label>
          <input
            id="name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="h-[52px] rounded-[14px] bg-surface-sunken px-3.5 text-[17px] font-medium text-ink outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="limit" className="text-[15px] font-semibold">
            Лимит на месяц
          </label>
          <MoneyField>
            <MoneyInput
              id="limit"
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
      </Card>

      {children}

      {error && <Notice tone="warn" title={error} />}
      <Spacer />
      <button
        type="button"
        disabled={saving || name.trim() === "" || !limitValid}
        onClick={save}
        className={primaryButtonClass}
      >
        {saving ? "Сохраняю…" : "Сохранить"}
      </button>
      {category && (
        <ConfirmButton
          label="Удалить категорию"
          title={`Удалить категорию «${category.name}»?`}
          description={
            expenseCount > 0
              ? `Траты в этой категории (${expenseCount}) тоже удалятся.`
              : "Трат в этой категории нет."
          }
          onConfirm={async () => {
            const result = await deleteCategory(category.id);
            if (result.ok) {
              router.push("/daily");
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
