import { randomBytes, scryptSync } from "node:crypto";
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

export const E2E_LOGIN = "e2e";
export const E2E_PASSWORD = "e2e-password";
export const E2E_PORT = 3100;

function hash(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export const e2eEnv = {
  DATABASE_URL: e2eDatabaseUrl(),
  AUTH_USERNAME: E2E_LOGIN,
  AUTH_PASSWORD_HASH: hash(E2E_PASSWORD),
  AUTH_SECRET: randomBytes(32).toString("hex"),
  PORT: String(E2E_PORT),
};
