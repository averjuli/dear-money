import Link from "next/link";
import { cn } from "@/lib/utils";
import { BackIcon, CloseIcon, PlusIcon } from "./icons";
import { NavItem, SECTIONS, type SectionKey } from "./nav-sections";

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

/**
 * Bottom row of the four sections; on «Конверты» and «Траты» the round «+»
 * for a new expense hangs above it on the right.
 */
export function BottomNav({ active }: { active: SectionKey }) {
  const withPlus = active === "envelopes" || active === "daily";
  const from = active === "daily" ? "/daily" : "/";
  return (
    <div className="pointer-events-none sticky bottom-[max(12px,env(safe-area-inset-bottom))] mt-2 flex flex-col items-end gap-2.5">
      {withPlus && (
        <Link
          href={`/expenses/new?from=${encodeURIComponent(from)}`}
          aria-label="Внести трату"
          className="pointer-events-auto flex size-[60px] shrink-0 items-center justify-center rounded-[20px] bg-accent text-white shadow-[0_2px_12px_rgba(20,33,27,0.12)]"
        >
          <PlusIcon />
        </Link>
      )}
      <nav
        aria-label="Разделы"
        className="pointer-events-auto grid w-full grid-cols-4 gap-1 rounded-[20px] bg-surface p-1.5 shadow-[0_2px_12px_rgba(20,33,27,0.06)]"
      >
        {SECTIONS.map((section) => (
          <NavItem
            key={section.key}
            section={section}
            active={active === section.key}
            layout="tab"
          />
        ))}
      </nav>
    </div>
  );
}
