import Link from "next/link";
import { DesktopScreen } from "@/components/desktop";
import { ChevronIcon } from "@/components/icons";
import { BottomNav, Screen, ScreenTitle, Spacer } from "@/components/screen";
import { Card } from "@/components/ui-kit";
import { logout } from "@/server/actions";
import { requireUserId } from "@/server/auth/current-user";
import { isDesktop } from "@/server/device";

export const dynamic = "force-dynamic";

function SettingsList() {
  return (
    <Card className="flex flex-col px-4">
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
  await requireUserId();

  if (await isDesktop()) {
    return (
      <DesktopScreen title="Настройки">
        <div className="max-w-[560px]">
          <SettingsList />
        </div>
      </DesktopScreen>
    );
  }

  return (
    <Screen>
      <ScreenTitle>Настройки</ScreenTitle>
      <SettingsList />
      <Spacer />
      <BottomNav active="settings" />
    </Screen>
  );
}
