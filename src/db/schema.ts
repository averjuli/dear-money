import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money columns are integer kopecks.

export const periodUnit = pgEnum("period_unit", ["week", "month", "year"]);
export const incomeKind = pgEnum("income_kind", ["salary", "advance", "other"]);
export const allocationKind = pgEnum("allocation_kind", [
  "contribution",
  "surplus",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: text("login").notNull().unique(),
  createdAt: createdAt(),
});

const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    seedKey: text("seed_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("wallets_user_idx").on(t.userId),
    uniqueIndex("wallets_user_seed_key_idx").on(t.userId, t.seedKey),
  ],
);

export const envelopes = pgTable(
  "envelopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    costPerTime: integer("cost_per_time").notNull(),
    periodN: integer("period_n").notNull(),
    periodUnit: periodUnit("period_unit").notNull(),
    contributionOverride: integer("contribution_override"),
    timesToSave: integer("times_to_save").notNull().default(3),
    startBalance: integer("start_balance").notNull().default(0),
    seedKey: text("seed_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("envelopes_user_idx").on(t.userId),
    index("envelopes_wallet_idx").on(t.walletId),
    uniqueIndex("envelopes_user_seed_key_idx").on(t.userId, t.seedKey),
    check("envelopes_cost_check", sql`${t.costPerTime} >= 0`),
    check("envelopes_period_check", sql`${t.periodN} >= 1`),
    check("envelopes_times_check", sql`${t.timesToSave} >= 1`),
  ],
);

export const spendCategories = pgTable(
  "spend_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    monthlyLimit: integer("monthly_limit"),
    position: integer("position").notNull(),
    seedKey: text("seed_key"),
    createdAt: createdAt(),
  },
  (t) => [
    index("spend_categories_user_idx").on(t.userId),
    uniqueIndex("spend_categories_user_seed_key_idx").on(t.userId, t.seedKey),
  ],
);

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    date: date("date").notNull(),
    amount: integer("amount").notNull(),
    kind: incomeKind("kind").notNull(),
    nextIncomeDate: date("next_income_date"),
    toEnvelopes: integer("to_envelopes").notNull(),
    toDaily: integer("to_daily").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("incomes_user_idx").on(t.userId),
    check("incomes_amount_check", sql`${t.amount} > 0`),
  ],
);

/** Saved allocation lines: never recalculated after the fact. */
export const allocations = pgTable(
  "allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    incomeId: uuid("income_id")
      .notNull()
      .references(() => incomes.id, { onDelete: "cascade" }),
    envelopeId: uuid("envelope_id")
      .notNull()
      .references(() => envelopes.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    kind: allocationKind("kind").notNull(),
    sourceEnvelopeId: uuid("source_envelope_id").references(
      () => envelopes.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    index("allocations_user_idx").on(t.userId),
    index("allocations_envelope_idx").on(t.envelopeId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    amount: integer("amount").notNull(),
    date: date("date").notNull(),
    note: text("note"),
    envelopeId: uuid("envelope_id").references(() => envelopes.id, {
      onDelete: "cascade",
    }),
    categoryId: uuid("category_id").references(() => spendCategories.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("expenses_user_idx").on(t.userId),
    index("expenses_envelope_idx").on(t.envelopeId),
    index("expenses_category_idx").on(t.categoryId),
    check("expenses_amount_check", sql`${t.amount} > 0`),
    check(
      "expenses_target_check",
      sql`(${t.envelopeId} is null) <> (${t.categoryId} is null)`,
    ),
  ],
);
