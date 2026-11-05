import { divCeil, divFloor } from "./money";

export type PeriodUnit = "week" | "month" | "year";

export const PERIOD_UNITS: readonly PeriodUnit[] = ["week", "month", "year"];

export type EnvelopeStatus = "minus" | "full" | "saving";

export interface ContributionSettings {
  costPerTime: number;
  periodN: number;
  periodUnit: PeriodUnit;
  contributionOverride: number | null;
}

export interface CeilingSettings {
  costPerTime: number;
  timesToSave: number;
}

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

/** A computed monthly contribution is rounded up to a multiple of 50 ₽. */
const CONTRIBUTION_STEP = 5000;

/** Divides, then rounds the result up to the contribution step (one rounding). */
function ceilToStep(dividend: number, divisor: number): number {
  return divCeil(dividend, divisor * CONTRIBUTION_STEP) * CONTRIBUTION_STEP;
}

/**
 * Contribution per month from cost and frequency, rounded up to 50 ₽,
 * unless set manually (a manual amount is used as is).
 */
export function monthlyContribution(env: ContributionSettings): number {
  if (env.contributionOverride !== null) return env.contributionOverride;
  if (env.periodN <= 0) return 0;
  switch (env.periodUnit) {
    case "week":
      return ceilToStep(
        env.costPerTime * WEEKS_PER_YEAR,
        env.periodN * MONTHS_PER_YEAR,
      );
    case "month":
      return ceilToStep(env.costPerTime, env.periodN);
    case "year":
      return ceilToStep(env.costPerTime, env.periodN * MONTHS_PER_YEAR);
  }
}

export function envelopeBalance(parts: {
  startBalance: number;
  allocated: number;
  spent: number;
}): number {
  return parts.startBalance + parts.allocated - parts.spent;
}

/** Cost per time × "save for N times". */
export function ceiling(env: CeilingSettings): number {
  return env.costPerTime * env.timesToSave;
}

/** Whole number of times the balance covers. Never negative. */
export function timesCovered(
  env: Pick<CeilingSettings, "costPerTime">,
  balance: number,
): number {
  if (env.costPerTime <= 0 || balance <= 0) return 0;
  return divFloor(balance, env.costPerTime);
}

export function envelopeStatus(
  env: CeilingSettings,
  balance: number,
): EnvelopeStatus {
  if (balance < 0) return "minus";
  if (balance >= ceiling(env)) return "full";
  return "saving";
}

export function isFull(env: CeilingSettings, balance: number): boolean {
  return envelopeStatus(env, balance) === "full";
}
