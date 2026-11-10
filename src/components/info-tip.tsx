"use client";

import { useEffect, useState } from "react";
import { CloseIcon, InfoIcon } from "@/components/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** How long the note stays on screen if nobody closes it. */
export const INFO_TIP_SECONDS = 8;

/**
 * «i» in a circle that opens a note. The note closes with the cross, with a
 * tap anywhere (the tap on the note itself too, and what was tapped outside
 * still works), with Esc, or by itself after INFO_TIP_SECONDS.
 */
export function InfoTip({
  label = "Пояснение",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), INFO_TIP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-white"
        >
          <InfoIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        role="note"
        aria-label={label}
        onClick={() => setOpen(false)}
        // Focus stays where it was: the note is read, not operated.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-start gap-2.5">
          <p className="m-0 grow text-sm leading-snug">{children}</p>
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
            className="-m-2 flex size-9 shrink-0 items-center justify-center bg-transparent text-ink-muted"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
