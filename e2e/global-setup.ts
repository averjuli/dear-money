import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { parseSeed, seedUserData } from "../src/db/seed";
import { DEMO_EMAIL, OTHER_EMAIL, e2eEnv } from "./env";
import { clearMailbox } from "./mailpit";

/** Fresh e2e database with the demo data: data/demo-seed.json. Empty mailbox. */
export default async function globalSetup() {
  await clearMailbox(); // also tells at once if Mailpit is not running
  const url = new URL(e2eEnv.DATABASE_URL);
  const dbName = url.pathname.slice(1);
  // The database is dropped below: refuse anything that is not clearly a test one.
  if (!dbName.includes("e2e")) {
    throw new Error(`Refusing to recreate "${dbName}": its name has no "e2e"`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  const [exists] =
    await admin`select 1 from pg_database where datname = ${dbName}`;
  const safeName = dbName.replace(/"/g, "");
  // Always from scratch: a database left by an older version may hold users
  // the migration cannot hand over. Only the e2e database is dropped.
  if (exists) {
    await admin.unsafe(`drop database "${safeName}" with (force)`);
  }
  await admin.unsafe(`create database "${safeName}"`);
  await admin.end();

  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  const seed = parseSeed(
    JSON.parse(readFileSync("data/demo-seed.json", "utf8")),
  );
  await seedUserData(db, DEMO_EMAIL, seed);
  // Another user with own data: must never show up for the e2e user.
  await seedUserData(db, OTHER_EMAIL, {
    wallets: [{ id: "x-w1", name: "Чужой кошелёк", order: 1 }],
    envelopes: [
      {
        id: "x-w1e1",
        walletId: "x-w1",
        name: "Чужой конверт",
        priority: 1,
        costPerTime: 100000,
        periodN: 1,
        periodUnit: "month",
        contributionOverride: null,
        timesToSave: 3,
        startBalance: 9900000,
      },
    ],
    spendCategories: [{ id: "x-d1", name: "Чужая категория" }],
  });
  await client.end();
}
