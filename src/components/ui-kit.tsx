import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[20px] bg-surface", className)}>{children}</div>
  );
}

/** Progress bar 8 px. `share` from 0 to 1. */
export function Bar({
  share,
  tone = "accent",
  track = "line",
  label,
}: {
  share: number;
  tone?: "accent" | "warn" | "white";
  track?: "line" | "accent-strong";
  label?: string;
}) {
  const width = `${Math.round(Math.min(Math.max(share, 0), 1) * 100)}%`;
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "h-2 overflow-hidden rounded-[4px]",
        track === "line" ? "bg-line" : "bg-accent-strong",
      )}
    >
      <div
        className={cn(
          "h-2 rounded-[4px]",
          tone === "accent" && "bg-accent",
          tone === "warn" && "bg-warn-bar",
          tone === "white" && "bg-white",
        )}
        style={{ width }}
      />
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="m-0 text-base font-semibold">{children}</h2>
      {hint && <div className="text-[13px] text-ink-muted">{hint}</div>}
    </div>
  );
}

/** Dashed «Добавить…» button-link. */
export function AddLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center justify-center rounded-[16px] border-2 border-dashed border-dash text-base font-medium text-ink no-underline"
    >
      {children}
    </Link>
  );
}

export function Notice({
  tone = "accent",
  title,
  children,
}: {
  tone?: "accent" | "warn";
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "warn" ? "alert" : undefined}
      className={cn(
        "flex flex-col gap-1 rounded-[16px] px-3.5 py-3",
        tone === "accent"
          ? "bg-accent-soft text-accent-strong"
          : "bg-warn-soft text-warn-strong",
      )}
    >
      {title && <div className="text-[15px] font-semibold">{title}</div>}
      {children && <div className="text-sm leading-snug">{children}</div>}
    </div>
  );
}

export const primaryButtonClass =
  "flex w-full items-center justify-center rounded-[16px] bg-accent p-[17px] text-[17px] font-semibold text-white no-underline disabled:opacity-50";
