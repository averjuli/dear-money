"use client";

import { formatMoneyInput, parseMoney } from "@/domain/money";
import { cn } from "@/lib/utils";

/** Amount field in rubles; keeps the raw text, formats it on blur. */
export function MoneyInput({
  id,
  value,
  onChange,
  size = "md",
  allowNegative = false,
  placeholder = "0",
  autoFocus,
  className,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  size?: "md" | "lg" | "xl";
  allowNegative?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        const allowed = allowNegative
          ? /^[−-]?[\d\s ]*([.,]\d{0,2})?$/
          : /^[\d\s ]*([.,]\d{0,2})?$/;
        if (allowed.test(next)) onChange(next);
      }}
      onBlur={() => {
        const parsed = parseMoney(value);
        if (parsed !== null) onChange(formatMoneyInput(parsed));
      }}
      className={cn(
        "min-w-0 grow border-none bg-transparent font-semibold text-ink outline-none placeholder:text-dash",
        size === "md" && "h-[52px] text-xl",
        size === "lg" && "h-14 font-display text-2xl",
        size === "xl" && "font-display text-[40px] leading-tight",
        className,
      )}
    />
  );
}

/** Sunken field wrapper with the ₽ sign. */
export function MoneyField({
  children,
  sign = "₽",
}: {
  children: React.ReactNode;
  sign?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[14px] bg-surface-sunken px-3.5">
      {children}
      <span className="whitespace-nowrap text-lg text-ink-muted">{sign}</span>
    </div>
  );
}
