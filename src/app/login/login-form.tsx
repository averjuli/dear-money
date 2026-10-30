"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice, primaryButtonClass } from "@/components/ui-kit";
import { login } from "@/server/actions";

const fieldClass =
  "h-[52px] rounded-[14px] border-none bg-surface-sunken px-3.5 text-[17px] shadow-none focus-visible:ring-2 focus-visible:ring-accent";

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      {!configured && (
        <Notice tone="warn" title="Вход ещё не настроен">
          Выполните в папке проекта команду pnpm auth:setup и перезапустите
          приложение.
        </Notice>
      )}
      <div className="flex flex-col gap-4 rounded-[20px] bg-surface p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username" className="text-[15px] font-semibold">
            Логин
          </Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-[15px] font-semibold">
            Пароль
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={fieldClass}
          />
        </div>
      </div>
      {state?.error && <Notice tone="warn" title={state.error} />}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
