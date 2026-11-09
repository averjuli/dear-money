import Link from "next/link";
import { cn } from "@/lib/utils";
import { BackIcon, CloseIcon } from "./icons";

/** Phone-width column with the paddings from the mockups. */
export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-3.5 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(56px,calc(env(safe-area-inset-top)+16px))]",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function ScreenTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="m-0 font-display text-2xl font-semibold leading-tight">
      {children}
    </h1>
  );
}

/** Back arrow, optional small caption and the screen title. */
export function ScreenHeader({
  backHref,
  backLabel,
  caption,
  title,
  action,
}: {
  backHref: string;
  backLabel: string;
  caption?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="-ml-3 flex size-11 shrink-0 items-center justify-center text-ink"
      >
        <BackIcon />
      </Link>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        {caption && <div className="text-sm text-ink-muted">{caption}</div>}
        <ScreenTitle>{title}</ScreenTitle>
      </div>
      {action}
    </div>
  );
}

export function CloseHeader({
  title,
  closeHref,
}: {
  title: string;
  closeHref: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <ScreenTitle>{title}</ScreenTitle>
      <Link
        href={closeHref}
        aria-label="Закрыть"
        className="-mr-2.5 flex size-11 items-center justify-center text-ink"
      >
        <CloseIcon />
      </Link>
    </div>
  );
}

export function Spacer() {
  return <div className="grow" />;
}
