import { cn } from "@/lib/utils";

export function Chip({
  selected,
  onClick,
  children,
  dashed,
  sunken,
}: {
  selected?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dashed?: boolean;
  /** Grey background when the chip stands inside a white card. */
  sunken?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={dashed ? undefined : selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full px-3.5 text-[15px]",
        dashed && "border-2 border-dashed border-dash bg-transparent text-ink",
        !dashed &&
          selected &&
          "border-2 border-accent bg-accent-soft font-semibold text-accent-strong",
        !dashed && !selected && (sunken ? "bg-surface-sunken" : "bg-surface"),
        !dashed && !selected && "text-ink",
      )}
    >
      {children}
    </button>
  );
}
