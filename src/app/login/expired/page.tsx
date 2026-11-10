import Link from "next/link";
import { Screen } from "@/components/screen";
import { primaryButtonClass } from "@/components/ui-kit";

export default function LinkExpiredPage() {
  return (
    <Screen className="justify-center">
      <div className="font-display text-[28px] font-semibold text-accent">
        dear money
      </div>
      <h1 className="m-0 font-display text-2xl font-semibold leading-tight">
        Ссылка устарела, запросите новую
      </h1>
      <Link href="/login" className={primaryButtonClass}>
        Запросить новую ссылку
      </Link>
    </Screen>
  );
}
