import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/screen";
import { Card, Notice, SectionTitle } from "@/components/ui-kit";
import { categoryStatus } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { formatRelativeDay } from "@/lib/text";
import { requireUserId } from "@/server/auth/current-user";
import {
  isUuid,
  loadCategories,
  loadExpenses,
  loadLatestIncome,
  periodStart,
} from "@/server/queries";
import { todayIso } from "@/server/today";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const today = todayIso();
  const income = await loadLatestIncome(userId);
  const categories = await loadCategories(userId, periodStart(income));
  const category = categories.find((c) => c.id === id);
  if (!category) notFound();
  const expenses = await loadExpenses(userId, { categoryId: id, limit: 100 });
  const status = categoryStatus(category.monthlyLimit, category.spent);

  return (
    <Screen>
      <ScreenHeader
        backHref="/daily"
        backLabel="Назад к повседневным тратам"
        caption="Повседневные траты · категория"
        title={category.name}
      />
      <CategoryForm
        category={{
          id: category.id,
          name: category.name,
          monthlyLimit: category.monthlyLimit,
        }}
        expenseCount={expenses.length}
      >
        <Notice
          tone={status.kind === "over" ? "warn" : "accent"}
          title={`За период потрачено ${formatMoney(category.spent)}`}
        >
          {status.kind === "over" &&
            `Это на ${formatMoney(status.over)} больше лимита.`}
          {status.kind === "ok" &&
            `До лимита осталось ${formatMoney(status.left)}.`}
          {status.kind === "none" && "Лимит не задан."}
        </Notice>

        {expenses.length > 0 && (
          <>
            <SectionTitle hint={`${expenses.length} всего`}>
              Последние траты
            </SectionTitle>
            <Card className="flex flex-col pl-4 pr-2">
              {expenses.slice(0, 20).map((e) => (
                <Link
                  key={e.id}
                  href={`/expenses/${e.id}?from=/daily/categories/${category.id}`}
                  className="flex min-h-[60px] items-center gap-2.5 border-b border-line text-ink no-underline last:border-b-0"
                >
                  <div className="flex grow flex-col gap-0.5">
                    <div className="text-[15px] font-semibold">
                      {e.note ?? category.name}
                    </div>
                    <div className="text-[13px] text-ink-muted">
                      {formatRelativeDay(e.date, today)}
                    </div>
                  </div>
                  <div className="pr-2 text-[15px] font-semibold">
                    {formatMoney(e.amount)}
                  </div>
                </Link>
              ))}
            </Card>
          </>
        )}
      </CategoryForm>
    </Screen>
  );
}
