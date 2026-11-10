import Link from "next/link";
import { Screen, ScreenTitle } from "@/components/screen";
import { primaryButtonClass } from "@/components/ui-kit";

/**
 * «Кошелёк не найден» / «Конверт не найден». Another person's record looks
 * exactly like one that does not exist: nothing is said about whose it is.
 */
export function NotFoundScreen({ title }: { title: string }) {
  return (
    <Screen>
      <ScreenTitle>{title}</ScreenTitle>
      <Link href="/" className={primaryButtonClass}>
        На главную
      </Link>
    </Screen>
  );
}
