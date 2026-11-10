import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { isValidEmail, normalizeEmail } from "../server/auth/email";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

// The owner's email goes to the migrations as a session setting: the
// migration that moves sign-in from login to email hands the existing data
// to this address. Unset is fine on an empty database; the migration itself
// refuses to run on existing data without it.
const rawOwner = process.env.OWNER_EMAIL?.trim() ?? "";
const ownerEmail = rawOwner ? normalizeEmail(rawOwner) : "";
if (rawOwner && !isValidEmail(ownerEmail)) {
  console.error("OWNER_EMAIL is not a valid email address");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

try {
  await client`select set_config('dear_money.owner_email', ${ownerEmail}, false)`;
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied");
} catch (error) {
  console.error("Migrations failed:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
