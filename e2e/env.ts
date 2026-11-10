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
