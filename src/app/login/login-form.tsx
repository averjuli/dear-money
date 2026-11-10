"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice, primaryButtonClass } from "@/components/ui-kit";
import { requestSignInLink } from "@/server/actions";

const fieldClass =
  "h-[52px] rounded-[14px] border-none bg-surface-sunken px-3.5 text-[17px] shadow-none focus-visible:ring-2 focus-visible:ring-accent";

export function LoginForm() {
  const [state, action, pending] = useActionState(requestSignInLink, null);
  const emailInvalid = state?.error === "email";
  return (
    <form action={action} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2 rounded-[20px] bg-surface p-4">
        <Label htmlFor="email" className="text-[15px] font-semibold">
          Почта
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          defaultValue={state?.typed ?? ""}
          aria-invalid={emailInvalid}
          aria-describedby={emailInvalid ? "email-error" : undefined}
          className={fieldClass}
        />
        {emailInvalid && (
          <p id="email-error" className="m-0 text-sm font-semibold text-warn">
            Проверьте адрес почты
          </p>
        )}
      </div>
      {state?.error === "too-often" && (
        <Notice
          tone="warn"
          title="Слишком часто, попробуйте через несколько минут"
        />
      )}
      {state?.error === "failed" && (
        <Notice
          tone="warn"
          title="Не удалось отправить письмо, попробуйте ещё раз"
        />
      )}
      {state?.sentTo && (
        <Notice title={`Ссылка для входа отправлена на ${state.sentTo}`} />
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Отправляем…" : "Получить ссылку"}
      </button>
    </form>
  );
}
