import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { parseSeed, seedUserData } from "../src/db/seed";
import { E2E_LOGIN, e2eEnv } from "./env";

/** Fresh e2e database with the demo data: data/demo-seed.json. */
export default async function globalSetup() {
  const url = new URL(e2eEnv.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  const [exists] =
    await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists)
    await admin.unsafe(`create database "${dbName.replace(/"/g, "")}"`);
  await admin.end();

  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await client`truncate table users cascade`;
  const seed = parseSeed(
    JSON.parse(readFileSync("data/demo-seed.json", "utf8")),
  );
  await seedUserData(db, E2E_LOGIN, seed);
  // Another user with own data: must never show up for the e2e user.
  await seedUserData(db, "someone-else", {
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
