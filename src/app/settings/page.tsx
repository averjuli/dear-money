import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { Screen, ScreenTitle } from "@/components/screen";
import { Card } from "@/components/ui-kit";
import { logout } from "@/server/actions";
import { requireUser } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

function SettingsList({ email }: { email: string }) {
  return (
    <Card className="flex flex-col px-4">
      <div className="min-h-14 content-center break-all border-b border-line text-base text-ink-muted">
        {email}
      </div>
      <Link
        href="/install"
        className="flex min-h-14 items-center gap-2.5 border-b border-line text-ink no-underline"
      >
        <div className="grow text-base font-semibold">
          Как установить на iPhone
        </div>
        <ChevronIcon className="text-ink-muted" />
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="flex min-h-14 w-full items-center bg-transparent text-base font-semibold text-warn"
        >
          Выйти
        </button>
      </form>
    </Card>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <Screen>
      <ScreenTitle>Настройки</ScreenTitle>
      <SettingsList email={user.email} />
    </Screen>
  );
}
