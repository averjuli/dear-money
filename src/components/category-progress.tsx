import { categoryStatus } from "@/domain/daily";
import { formatMoney } from "@/domain/money";
import { cn } from "@/lib/utils";
import { Bar } from "./ui-kit";

/** Daily category on desktop: spent, and against the limit when there is one. */
export function CategoryProgress({
  name,
  limit,
  spent,
  compact,
}: {
  name: string;
  limit: number | null;
  spent: number;
  /** Smaller text for the side column of the main screen. */
  compact?: boolean;
}) {
  const status = categoryStatus(limit, spent);
  const text = compact ? "text-sm" : "text-[15px]";
  if (status.kind === "none") {
    return (
      <div className={cn("flex justify-between gap-2 font-semibold", text)}>
        <div>{name}</div>
        <div>{formatMoney(spent)}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex justify-between gap-2 font-semibold", text)}>
        <div>{name}</div>
        <div className={cn(status.kind === "over" && "text-warn")}>
          {formatMoney(spent)} из {formatMoney(limit!)}
        </div>
      </div>
      <Bar
        share={status.share}
        tone={status.kind === "over" ? "warn" : "accent"}
      />
      {status.kind === "over" ? (
        <div className="text-[13px] font-medium text-warn">
          лимит превышен на {formatMoney(status.over)}
        </div>
      ) : (
        !compact && (
          <div className="text-[13px] text-ink-muted">
            осталось {formatMoney(status.left)}
          </div>
        )
      )}
    </div>
  );
}
