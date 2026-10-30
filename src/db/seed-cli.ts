import { readFileSync } from "node:fs";
import { getDb } from "./client";
import { parseSeed, seedUserData } from "./seed";

// Usage: pnpm db:seed <file.json> [--login <login>]
// The login defaults to AUTH_USERNAME, the account that signs in to the app.

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const loginFlag = args.indexOf("--login");
const login =
  loginFlag >= 0 ? args[loginFlag + 1] : process.env.AUTH_USERNAME?.trim();

if (!file) {
  console.error("Usage: pnpm db:seed <file.json> [--login <login>]");
  process.exit(1);
}
if (!login) {
  console.error(
    "No login: run `pnpm auth:setup` first or pass --login <login>",
  );
  process.exit(1);
}

try {
  const data = parseSeed(JSON.parse(readFileSync(file, "utf8")));
  if (data.expenses?.length || data.incomes?.length) {
    console.warn("Expenses and incomes in the seed file are not loaded yet");
  }
  const result = await seedUserData(getDb(), login, data);
  console.log(
    `Loaded for "${login}": ${result.wallets} wallets, ${result.envelopes} envelopes, ${result.spendCategories} daily categories (already present rows skipped)`,
  );
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
