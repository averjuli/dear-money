import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

// e2e runs against a separate database next to the dev one, never the dev data.
if (existsSync(".env")) process.loadEnvFile(".env");

function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or E2E_DATABASE_URL for e2e");
  const url = new URL(base);
  url.pathname = "/dear_money_e2e";
  return url.toString();
}

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** The user of the main scenario; global-setup loads data/demo-seed.json for it. */
export const DEMO_EMAIL = "demo@example.test";
/** Another user with own data that must never show up for the demo user. */
export const OTHER_EMAIL = "someone-else@example.test";

/**
 * Users of the income-history scenarios, each with own data so that the
 * scenarios do not touch the demo data: a wallet with two envelopes, a copy of
 * the demo data, and a user who owns an income that others must never reach.
 */
export const AB_EMAIL = "ab-user@example.test";
export const DEMO_COPY_EMAIL = "demo-copy@example.test";
export const INCOME_OWNER_EMAIL = "income-owner@example.test";
export const AB_AUTH_FILE = "e2e/.auth/ab.json";
export const DEMO_COPY_AUTH_FILE = "e2e/.auth/demo-copy.json";

/** Where the mail catcher from docker-compose.yml listens. */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const SMTP_HOST = process.env.E2E_SMTP_HOST ?? "localhost";
const SMTP_PORT = process.env.E2E_SMTP_PORT ?? "1025";

/** Where the saved sign-in of the demo user lives (see auth.setup.ts). */
export const DEMO_AUTH_FILE = "e2e/.auth/demo.json";

export const e2eEnv = {
  DATABASE_URL: e2eDatabaseUrl(),
  AUTH_SECRET: randomBytes(32).toString("hex"),
  BETTER_AUTH_URL: E2E_BASE_URL,
  SMTP_HOST,
  SMTP_PORT,
  PORT: String(E2E_PORT),
};
