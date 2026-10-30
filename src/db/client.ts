import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { dearMoneyDb?: Db };

/** One connection pool per process, reused across hot reloads in dev. */
export function getDb(): Db {
  globalForDb.dearMoneyDb ??= createDb();
  return globalForDb.dearMoneyDb;
}
