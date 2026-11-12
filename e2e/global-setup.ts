import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { parseSeed, seedUserData } from "../src/db/seed";
import {
  AB_EMAIL,
  DEMO_COPY_EMAIL,
  DEMO_EMAIL,
  INCOME_OWNER_EMAIL,
  OTHER_EMAIL,
  e2eEnv,
} from "./env";
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

  // The income-history scenarios: a copy of the demo data to change freely.
  await seedUserData(db, DEMO_COPY_EMAIL, seed);
  // A wallet «Wallet» with two envelopes. Half of the monthly contribution per
  // income: Alpha 500 ₽ (balance 500 ₽ of 1 000 ₽), Beta 400 ₽ (balance 0 of 800 ₽).
  const envelope = {
    periodN: 1,
    periodUnit: "month" as const,
    contributionOverride: null,
    timesToSave: 1,
    walletId: "ab-w",
  };
  await seedUserData(db, AB_EMAIL, {
    wallets: [{ id: "ab-w", name: "Wallet", order: 1 }],
    envelopes: [
      {
        ...envelope,
        id: "ab-a",
        name: "Alpha",
        priority: 1,
        costPerTime: 100000,
        startBalance: 50000,
      },
      {
        ...envelope,
        id: "ab-b",
        name: "Beta",
        priority: 2,
        costPerTime: 80000,
        startBalance: 0,
      },
    ],
    spendCategories: [{ id: "ab-d", name: "Продукты" }],
  });
  // Another user with an income: its address must stay out of reach.
  await seedUserData(db, INCOME_OWNER_EMAIL, {
    wallets: [{ id: "io-w", name: "Owner wallet", order: 1 }],
    envelopes: [],
    spendCategories: [],
  });
  const [owner] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, INCOME_OWNER_EMAIL));
  await db.insert(schema.incomes).values({
    userId: owner.id,
    date: "2026-01-10",
    amount: 123400,
    kind: "other",
    toEnvelopes: 0,
    toDaily: 123400,
  });
  await client.end();
}
