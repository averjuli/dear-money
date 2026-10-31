import Link from "next/link";
import { cn } from "@/lib/utils";

/** Desktop content column: up to 1180 px, header with caption or back link, title and action. */
export function DesktopScreen({
  caption,
  back,
  title,
  action,
  children,
}: {
  caption?: string;
  back?: { href: string; label: string };
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="px-[clamp(16px,3vw,40px)] pb-10 pt-8">
      <div className="flex w-full max-w-[1180px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {back ? (
              <Link
                href={back.href}
                className="text-sm font-medium no-underline"
              >
                ← {back.label}
              </Link>
            ) : (
              caption && <div className="text-sm text-ink-muted">{caption}</div>
            )}
            <h1 className="m-0 font-display text-[30px] font-semibold leading-tight">
              {title}
            </h1>
          </div>
          {action}
        </header>
        {children}
      </div>
    </main>
  );
}

/** White card with the desktop paddings. */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3.5 rounded-[20px] bg-surface px-[22px] py-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="m-0 text-[17px] font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export const desktopButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-accent px-5 text-[15px] font-semibold text-white no-underline disabled:opacity-50";
