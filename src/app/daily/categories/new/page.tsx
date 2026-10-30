import { Screen, ScreenHeader } from "@/components/screen";
import { requireUserId } from "@/server/auth/current-user";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  await requireUserId();
  return (
    <Screen>
      <ScreenHeader
        backHref="/daily"
        backLabel="Назад к повседневным тратам"
        caption="Повседневные траты"
        title="Новая категория"
      />
      <CategoryForm category={null} expenseCount={0} />
    </Screen>
  );
}
