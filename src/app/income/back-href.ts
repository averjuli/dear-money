/** Screens an income can be opened from; anything else leads to «Пришли деньги». */
const INCOME_BACK_HREFS = ["/income", "/income/all"];

/** «назад» of an income screen: the `from` of the address, if it is a known screen. */
export function incomeBackHref(from: string | string[] | undefined): string {
  const value = Array.isArray(from) ? from[0] : from;
  return value !== undefined && INCOME_BACK_HREFS.includes(value)
    ? value
    : "/income";
}
