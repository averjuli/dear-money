// Calendar dates are kept as "YYYY-MM-DD" in the user's time zone.
const TIME_ZONE = process.env.APP_TIME_ZONE ?? "Europe/Moscow";

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** First day of the current month, "YYYY-MM-01". */
export function monthStartIso(now = new Date()): string {
  return `${todayIso(now).slice(0, 7)}-01`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
