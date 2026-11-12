import type { TransferSide } from "@/domain/transfer";

/** Russian plural: plural(3, ["конверт", "конверта", "конвертов"]) → "конверта". */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export const countEnvelopes = (n: number) =>
  `${n} ${plural(n, ["конверт", "конверта", "конвертов"])}`;

export const countTimes = (n: number) =>
  `${n} ${plural(n, ["раз", "раза", "раз"])}`;

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const MONTHS_PREPOSITIONAL = [
  "январе",
  "феврале",
  "марте",
  "апреле",
  "мае",
  "июне",
  "июле",
  "августе",
  "сентябре",
  "октябре",
  "ноябре",
  "декабре",
];

const MONTHS_NOMINATIVE = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/** "2026-11-05" → "5 ноября" (with the year if it differs from today's). */
export function formatDay(iso: string, today?: string): string {
  const [y, m, d] = parts(iso);
  const sameYear = !today || parts(today)[0] === y;
  return `${d} ${MONTHS_GENITIVE[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

/** "сегодня", "вчера" or "18 сентября". */
export function formatRelativeDay(iso: string, today: string): string {
  if (iso === today) return "сегодня";
  const [y, m, d] = parts(today);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1))
    .toISOString()
    .slice(0, 10);
  if (iso === yesterday) return "вчера";
  return formatDay(iso, today);
}

export function monthName(iso: string): string {
  return MONTHS_NOMINATIVE[parts(iso)[1] - 1];
}

/** "2026-11-05" → "в ноябре". */
export function monthNamePrepositional(iso: string): string {
  return `в ${MONTHS_PREPOSITIONAL[parts(iso)[1] - 1]}`;
}

const UNIT_FORMS = {
  week: ["неделю", "недели", "недель"],
  month: ["месяц", "месяца", "месяцев"],
  year: ["год", "года", "лет"],
} as const;

/** "раз в 2 месяца", "раз в месяц". */
export function formatFrequency(
  n: number,
  unit: keyof typeof UNIT_FORMS,
): string {
  const forms = UNIT_FORMS[unit] as unknown as [string, string, string];
  return n === 1 ? `раз в ${forms[0]}` : `раз в ${n} ${plural(n, forms)}`;
}

/** "2 месяца", "12 месяцев". */
export function countMonths(n: number): string {
  return `${n} ${plural(n, ["месяц", "месяца", "месяцев"])}`;
}

export function quoted(name: string): string {
  return `«${name}»`;
}

/**
 * Label of a transfer in the history of one side: the other side of the
 * transfer, with the direction («В конверт «X»», «Из конверта «X»», «На жизнь»,
 * «Из денег на жизнь», «В удалённый конверт», «Из удалённого конверта»).
 */
export function transferLabel(
  transfer: {
    from: TransferSide;
    to: TransferSide;
    fromName: string | null;
    toName: string | null;
  },
  viewpoint: TransferSide,
): string {
  // The money left the viewpoint when the viewpoint is the source.
  const left =
    viewpoint.kind === "daily"
      ? transfer.from.kind === "daily"
      : viewpoint.kind === "envelope" &&
        transfer.from.kind === "envelope" &&
        transfer.from.envelopeId === viewpoint.envelopeId;
  if (left) {
    if (transfer.to.kind === "daily") return "На жизнь";
    if (transfer.to.kind === "deleted") return "В удалённый конверт";
    return `В конверт ${quoted(transfer.toName ?? "")}`;
  }
  if (transfer.from.kind === "daily") return "Из денег на жизнь";
  if (transfer.from.kind === "deleted") return "Из удалённого конверта";
  return `Из конверта ${quoted(transfer.fromName ?? "")}`;
}

export type IncomeKind = "salary" | "advance" | "other";

/** Kinds of income in the order of the chips on the «Пришли деньги» form. */
export const INCOME_KINDS: readonly { value: IncomeKind; label: string }[] = [
  { value: "salary", label: "Зарплата" },
  { value: "advance", label: "Аванс" },
  { value: "other", label: "Другое" },
];

export function incomeKindLabel(kind: IncomeKind): string {
  return INCOME_KINDS.find((k) => k.value === kind)?.label ?? "";
}
