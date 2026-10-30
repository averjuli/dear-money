"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Red text button that asks for confirmation on screen before acting. */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = "Удалить",
  onConfirm,
}: {
  label: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 bg-transparent text-base font-medium text-warn"
        >
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[20px] border-none bg-surface font-sans">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-ink">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-[15px] leading-snug text-ink-muted">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11 rounded-[14px] border-none bg-surface-sunken text-[15px] text-ink">
            Отмена
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="min-h-11 rounded-[14px] bg-warn text-[15px] text-white hover:bg-warn-strong"
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
