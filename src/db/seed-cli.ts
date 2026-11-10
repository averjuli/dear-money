import { readFileSync } from "node:fs";
import { normalizeEmail } from "../server/auth/email";
import { getDb } from "./client";
import { parseSeed, seedUserData } from "./seed";

// Usage: pnpm db:seed <file.json> [--email <email>]
// The email defaults to OWNER_EMAIL, the owner of the existing data.

const args = process.argv.slice(2);
const emailFlag = args.indexOf("--email");
const file = args.find(
  (a, i) => !a.startsWith("--") && (emailFlag < 0 || i !== emailFlag + 1),
);
const rawEmail =
  emailFlag >= 0 ? args[emailFlag + 1] : process.env.OWNER_EMAIL?.trim();

if (!file) {
  console.error("Usage: pnpm db:seed <file.json> [--email <email>]");
  process.exit(1);
}
if (!rawEmail) {
  console.error(
    "No email: set OWNER_EMAIL in .env or pass --email <email> to say whose data this is",
  );
  process.exit(1);
}

try {
  const data = parseSeed(JSON.parse(readFileSync(file, "utf8")));
  if (data.expenses?.length || data.incomes?.length) {
    console.warn("Expenses and incomes in the seed file are not loaded yet");
  }
  const result = await seedUserData(getDb(), rawEmail, data);
  console.log(
    `Loaded for "${normalizeEmail(rawEmail)}": ${result.wallets} wallets, ${result.envelopes} envelopes, ${result.spendCategories} daily categories (already present rows skipped)`,
  );
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
